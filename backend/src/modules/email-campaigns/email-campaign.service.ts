import { AppDataSource } from '../../infra/database/data-source';
import { logger } from '../../common/logger';
import { NotFoundError, ValidationError } from '../../common/errors';
import { offsetOf, paginate, type Paginated, type PaginationDto } from '../../common/pagination';
import { sendEmail } from '../../infra/email/brevo-mailer';
import { networkSettingService } from '../network-settings/network-setting.service';
import { substituteMacros } from '../email-templates/template-render';
import { Advertiser, AdvertiserStatus } from '../advertisers/advertiser.entity';
import { Affiliate } from '../affiliates/affiliate.entity';
import { Manager } from '../managers/manager.entity';
import { User, UserStatus } from '../users/user.entity';
import {
  CampaignAudience,
  CampaignRecipientStatus,
  CampaignStatus,
  EmailCampaign,
  EmailCampaignRecipient,
} from './email-campaign.entity';
import {
  RECIPIENT_MACROS,
  type AudienceCountsDto,
  type CampaignDto,
  type CampaignRecipientDto,
  type CampaignRecipientsQuery,
  type CreateCampaignDto,
} from './email-campaign.dto';

const MACRO_PATTERN = /\{([a-z0-9_]+)\}/gi;
const INSERT_CHUNK = 500;
const SEND_BATCH = 50;

interface Target {
  email: string;
  kind: string;
  fullName: string | null;
  publicId: string | null;
}

// BLOCKED and REJECTED are excluded in every mode: mailing someone the network has
// turned away is worse than missing them.
function userStatuses(activeOnly: boolean): UserStatus[] {
  return activeOnly ? [UserStatus.ACTIVE] : [UserStatus.ACTIVE, UserStatus.PENDING, UserStatus.INACTIVE];
}

async function resolveTargets(audience: CampaignAudience, activeOnly: boolean): Promise<Target[]> {
  const targets: Target[] = [];
  const wantsAll = audience === CampaignAudience.ALL;

  if (wantsAll || audience === CampaignAudience.AFFILIATES) {
    const rows = await AppDataSource.getRepository(Affiliate)
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.user', 'u')
      .where('u.status IN (:...statuses)', { statuses: userStatuses(activeOnly) })
      .getMany();
    for (const row of rows) {
      targets.push({ email: row.user.email, kind: 'AFFILIATES', fullName: row.fullName, publicId: row.publicId });
    }
  }

  if (wantsAll || audience === CampaignAudience.MANAGERS) {
    const rows = await AppDataSource.getRepository(Manager)
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.user', 'u')
      .where('u.status IN (:...statuses)', { statuses: userStatuses(activeOnly) })
      .getMany();
    for (const row of rows) {
      targets.push({ email: row.user.email, kind: 'MANAGERS', fullName: row.fullName, publicId: row.publicId });
    }
  }

  if (wantsAll || audience === CampaignAudience.ADVERTISERS) {
    const statuses = activeOnly ? [AdvertiserStatus.ACTIVE] : [AdvertiserStatus.ACTIVE, AdvertiserStatus.PENDING];
    const rows = await AppDataSource.getRepository(Advertiser)
      .createQueryBuilder('v')
      .where('v.status IN (:...statuses)', { statuses })
      .andWhere(`v."contactEmail" IS NOT NULL AND v."contactEmail" <> ''`)
      .getMany();
    for (const row of rows) {
      targets.push({ email: row.contactEmail!, kind: 'ADVERTISERS', fullName: row.contactName ?? row.name, publicId: null });
    }
  }

  // One person can sit in two groups (a manager who is also an advertiser contact);
  // they get one email. First occurrence wins.
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = target.email.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    target.email = key;
    return true;
  });
}

function recipientMacros(recipient: Pick<EmailCampaignRecipient, 'email' | 'fullName' | 'publicId'>) {
  const full = recipient.fullName?.trim() || '';
  return {
    first_name: full.split(/\s+/)[0] || 'there',
    full_name: full || recipient.email,
    email: recipient.email,
    public_id: recipient.publicId ?? '',
  };
}

/** Which `{macros}` the text uses that neither the system, the recipient nor the admin fills. */
async function unresolvedMacros(subject: string, body: string, supplied: Record<string, string>): Promise<string[]> {
  const settings = await networkSettingService.getSettings();
  const known = new Set<string>([
    ...RECIPIENT_MACROS,
    'network_name',
    ...(settings.supportEmail ? ['support_email'] : []),
    ...Object.entries(supplied)
      .filter(([, value]) => value)
      .map(([key]) => key),
  ]);
  return [...new Set([...`${subject}\n${body}`.matchAll(MACRO_PATTERN)].map((m) => m[1]!))].filter((n) => !known.has(n));
}

async function toDto(campaign: EmailCampaign): Promise<CampaignDto> {
  const creator = campaign.createdById
    ? await AppDataSource.getRepository(User).findOne({ where: { id: campaign.createdById }, select: { email: true } })
    : null;
  return {
    id: campaign.id,
    subject: campaign.subject,
    body: campaign.body,
    audience: campaign.audience,
    activeOnly: campaign.activeOnly,
    status: campaign.status,
    totalRecipients: campaign.totalRecipients,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    pendingCount: Math.max(campaign.totalRecipients - campaign.sentCount - campaign.failedCount, 0),
    createdByEmail: creator?.email ?? null,
    createdAt: campaign.createdAt.toISOString(),
    finishedAt: campaign.finishedAt?.toISOString() ?? null,
  };
}

// Campaigns currently being worked by this process. Guards against starting a second
// runner for one campaign (a retry clicked while the first pass is still going).
const running = new Set<string>();

async function run(campaignId: string): Promise<void> {
  if (running.has(campaignId)) return;
  running.add(campaignId);

  const campaigns = AppDataSource.getRepository(EmailCampaign);
  const recipients = AppDataSource.getRepository(EmailCampaignRecipient);

  try {
    const settings = await networkSettingService.getSettings();
    const fixed: Record<string, string> = {
      network_name: settings.networkName,
      support_email: settings.supportEmail ?? '',
    };

    for (;;) {
      const campaign = await campaigns.findOne({ where: { id: campaignId } });
      if (!campaign || campaign.status !== CampaignStatus.SENDING) return;

      const batch = await recipients.find({
        where: { campaignId, status: CampaignRecipientStatus.PENDING },
        order: { email: 'ASC' },
        take: SEND_BATCH,
      });
      if (batch.length === 0) {
        await campaigns.update(campaignId, { status: CampaignStatus.COMPLETED, finishedAt: new Date() });
        return;
      }

      for (const recipient of batch) {
        // Re-read per recipient so a cancel takes effect within one send, not one batch.
        const current = await campaigns.findOne({ where: { id: campaignId }, select: { status: true } });
        if (current?.status !== CampaignStatus.SENDING) return;

        const macros = { ...fixed, ...(campaign.macros ?? {}), ...recipientMacros(recipient) };
        try {
          // Sequential on purpose: each person gets their own copy and a burst of
          // parallel calls is what trips the relay's rate limiting.
          await sendEmail({
            to: { email: recipient.email, name: recipient.fullName },
            subject: substituteMacros(campaign.subject, macros),
            body: substituteMacros(campaign.body, macros),
          });
          await recipients.update(recipient.id, { status: CampaignRecipientStatus.SENT, sentAt: new Date(), error: null });
          await campaigns.increment({ id: campaignId }, 'sentCount', 1);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Send failed';
          logger.warn({ err, email: recipient.email, campaignId }, 'Campaign email failed');
          await recipients.update(recipient.id, { status: CampaignRecipientStatus.FAILED, error: message.slice(0, 1000) });
          await campaigns.increment({ id: campaignId }, 'failedCount', 1);
        }
      }
    }
  } catch (err) {
    // A crash here leaves the campaign SENDING, so the next boot resumes it.
    logger.error({ err, campaignId }, 'Campaign runner stopped unexpectedly');
  } finally {
    running.delete(campaignId);
  }
}

export const emailCampaignService = {
  async audienceCounts(activeOnly: boolean): Promise<AudienceCountsDto> {
    const [affiliates, managers, advertisers, all] = await Promise.all([
      resolveTargets(CampaignAudience.AFFILIATES, activeOnly),
      resolveTargets(CampaignAudience.MANAGERS, activeOnly),
      resolveTargets(CampaignAudience.ADVERTISERS, activeOnly),
      resolveTargets(CampaignAudience.ALL, activeOnly),
    ]);
    return { AFFILIATES: affiliates.length, MANAGERS: managers.length, ADVERTISERS: advertisers.length, ALL: all.length };
  },

  async create(dto: CreateCampaignDto, adminId: string): Promise<CampaignDto> {
    const unresolved = await unresolvedMacros(dto.subject, dto.body, dto.macros ?? {});
    if (unresolved.length > 0) {
      throw new ValidationError(
        `Fill in a value for ${unresolved.map((name) => `{${name}}`).join(', ')} — or remove it from the text.`,
      );
    }

    const targets = await resolveTargets(dto.audience, dto.activeOnly);
    if (targets.length === 0) {
      throw new ValidationError('That audience has no one with an email address to send to');
    }
    if (targets.length !== dto.expectedRecipients) {
      throw new ValidationError(
        `The audience changed: it now has ${targets.length} recipients, not ${dto.expectedRecipients}. Review and confirm again.`,
      );
    }

    const campaign = await AppDataSource.transaction(async (manager) => {
      const campaignRepo = manager.getRepository(EmailCampaign);
      const created = await campaignRepo.save(
        campaignRepo.create({
          subject: dto.subject,
          body: dto.body,
          macros: dto.macros ?? null,
          audience: dto.audience,
          activeOnly: dto.activeOnly,
          status: CampaignStatus.SENDING,
          totalRecipients: targets.length,
          createdById: adminId,
        }),
      );
      const repo = manager.getRepository(EmailCampaignRecipient);
      for (let i = 0; i < targets.length; i += INSERT_CHUNK) {
        await repo.insert(targets.slice(i, i + INSERT_CHUNK).map((target) => ({ ...target, campaignId: created.id })));
      }
      return created;
    });

    // Not awaited: the request returns at once and the admin watches progress.
    void run(campaign.id);
    return toDto(campaign);
  },

  async list(pagination: PaginationDto): Promise<Paginated<CampaignDto>> {
    const [rows, total] = await AppDataSource.getRepository(EmailCampaign).findAndCount({
      order: { createdAt: 'DESC' },
      skip: offsetOf(pagination),
      take: pagination.pageSize,
    });
    return paginate(await Promise.all(rows.map(toDto)), total, pagination);
  },

  async get(id: string): Promise<CampaignDto> {
    const campaign = await AppDataSource.getRepository(EmailCampaign).findOne({ where: { id } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    return toDto(campaign);
  },

  async recipients(id: string, query: CampaignRecipientsQuery): Promise<Paginated<CampaignRecipientDto>> {
    await this.get(id);
    const [rows, total] = await AppDataSource.getRepository(EmailCampaignRecipient).findAndCount({
      where: { campaignId: id, ...(query.status && { status: query.status }) },
      order: { email: 'ASC' },
      skip: offsetOf(query),
      take: query.pageSize,
    });
    return paginate(
      rows.map((row) => ({
        id: row.id,
        email: row.email,
        kind: row.kind,
        fullName: row.fullName,
        status: row.status,
        error: row.error,
        sentAt: row.sentAt?.toISOString() ?? null,
      })),
      total,
      query,
    );
  },

  /** Stops further sends; anything already delivered stays delivered. */
  async cancel(id: string): Promise<CampaignDto> {
    const campaigns = AppDataSource.getRepository(EmailCampaign);
    const campaign = await campaigns.findOne({ where: { id } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    if (campaign.status !== CampaignStatus.SENDING) throw new ValidationError('This campaign is not sending');

    await campaigns.update(id, { status: CampaignStatus.CANCELLED, finishedAt: new Date() });
    await AppDataSource.getRepository(EmailCampaignRecipient).update(
      { campaignId: id, status: CampaignRecipientStatus.PENDING },
      { status: CampaignRecipientStatus.SKIPPED },
    );
    return this.get(id);
  },

  /** Re-queues the recipients whose send failed, and nobody else. */
  async retryFailed(id: string): Promise<CampaignDto> {
    const campaigns = AppDataSource.getRepository(EmailCampaign);
    const campaign = await campaigns.findOne({ where: { id } });
    if (!campaign) throw new NotFoundError('Campaign not found');
    if (campaign.status === CampaignStatus.SENDING) throw new ValidationError('This campaign is still sending');
    if (campaign.status === CampaignStatus.CANCELLED) throw new ValidationError('A cancelled campaign cannot be retried');
    if (campaign.failedCount === 0) throw new ValidationError('Nothing failed in this campaign');

    await AppDataSource.getRepository(EmailCampaignRecipient).update(
      { campaignId: id, status: CampaignRecipientStatus.FAILED },
      { status: CampaignRecipientStatus.PENDING, error: null },
    );
    await campaigns.update(id, { status: CampaignStatus.SENDING, failedCount: 0, finishedAt: null });
    void run(id);
    return this.get(id);
  },

  /** Boot hook: picks up campaigns a restart interrupted. */
  async resumeInterrupted(): Promise<void> {
    const open = await AppDataSource.getRepository(EmailCampaign).find({
      where: { status: CampaignStatus.SENDING },
      select: { id: true },
    });
    for (const campaign of open) void run(campaign.id);
    if (open.length > 0) logger.info({ count: open.length }, 'Resuming interrupted email campaigns');
  },
};
