import { ValidationError } from '../../common/errors';
import { networkSettingRepository } from './network-setting.repository';
import { invalidateTrackerSettings } from './tracker-settings';
import type { NetworkSetting } from './network-setting.entity';
import {
  toNetworkSettingsDto,
  type NetworkSettingsDto,
  type UpdateNetworkSettingsDto,
} from './network-setting.dto';

async function loadOrCreate(): Promise<NetworkSetting> {
  return (await networkSettingRepository.find()) ?? (await networkSettingRepository.createDefault());
}

export const networkSettingService = {
  async getSettings(): Promise<NetworkSettingsDto> {
    return toNetworkSettingsDto(await loadOrCreate());
  },

  async updateSettings(dto: UpdateNetworkSettingsDto): Promise<NetworkSettingsDto> {
    const current = await loadOrCreate();

    // The cross-field fraud-band check in the schema only fires when both values are
    // sent together; re-check against the stored value when only one is changing.
    const suspect = dto.fraudSuspectThreshold ?? current.fraudSuspectThreshold;
    const block = dto.fraudBlockThreshold ?? current.fraudBlockThreshold;
    if (suspect >= block) {
      throw new ValidationError('fraudSuspectThreshold must be below fraudBlockThreshold');
    }

    await networkSettingRepository.update({
      ...(dto.networkName !== undefined && { networkName: dto.networkName }),
      ...(dto.supportEmail !== undefined && { supportEmail: dto.supportEmail ?? null }),
      ...(dto.supportTelegram !== undefined && { supportTelegram: dto.supportTelegram ?? null }),
      ...(dto.emailProvider !== undefined && { emailProvider: dto.emailProvider }),
      ...(dto.defaultCurrency !== undefined && { defaultCurrency: dto.defaultCurrency.toUpperCase() }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.defaultHoldDays !== undefined && { defaultHoldDays: dto.defaultHoldDays }),
      ...(dto.minimumPayoutThreshold !== undefined && {
        minimumPayoutThreshold: dto.minimumPayoutThreshold.toFixed(2),
      }),
      ...(dto.payoutCycleDays !== undefined && { payoutCycleDays: dto.payoutCycleDays }),
      ...(dto.autoApproveAffiliates !== undefined && { autoApproveAffiliates: dto.autoApproveAffiliates }),
      ...(dto.autoApproveConversions !== undefined && { autoApproveConversions: dto.autoApproveConversions }),
      ...(dto.pointsPerConversion !== undefined && { pointsPerConversion: dto.pointsPerConversion }),
      ...(dto.fraudSuspectThreshold !== undefined && { fraudSuspectThreshold: dto.fraudSuspectThreshold }),
      ...(dto.fraudBlockThreshold !== undefined && { fraudBlockThreshold: dto.fraudBlockThreshold }),
      ...(dto.blockedRedirectUrl !== undefined && { blockedRedirectUrl: dto.blockedRedirectUrl ?? null }),
      ...(dto.loginRateLimitPerMinute !== undefined && { loginRateLimitPerMinute: dto.loginRateLimitPerMinute }),
      ...(dto.clickRateLimitPerMinute !== undefined && { clickRateLimitPerMinute: dto.clickRateLimitPerMinute }),
      ...(dto.senderEmail !== undefined && { senderEmail: dto.senderEmail ?? null }),
      ...(dto.senderName !== undefined && { senderName: dto.senderName ?? null }),
    });

    // The tracker caches the fraud bands and the blocked-redirect URL for a short TTL
    // (see tracker-settings.ts) — drop it so a change here applies to the very next
    // click in this process rather than up to a minute later.
    invalidateTrackerSettings();

    return this.getSettings();
  },
};
