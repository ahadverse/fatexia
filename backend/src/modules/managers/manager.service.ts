import { AppDataSource } from '../../infra/database/data-source';
import { NotFoundError, ValidationError } from '../../common/errors';
import { nextPublicId } from '../../common/public-id';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { userProvisioningService } from '../users/user-provisioning.service';
import { networkSettingService } from '../network-settings/network-setting.service';
import { Manager } from './manager.entity';
import { managerRepository } from './manager.repository';
import {
  toManagerContactDto,
  toManagerDto,
  toSupportContactDto,
  type AffiliateManagerContactDto,
  type CreateManagerDto,
  type ManagerDto,
  type ManagerFiltersDto,
  type UpdateManagerDto,
  type UpdateManagerStatusDto,
} from './manager.dto';

export const managerService = {
  async getManagers(filters: ManagerFiltersDto): Promise<ManagerDto[]> {
    const [managers, counts] = await Promise.all([
      managerRepository.findAll(filters),
      managerRepository.affiliateCountsByManager(),
    ]);
    const countById = new Map(counts.map((c) => [c.assignedManagerId, Number(c.count)]));
    return managers.map((manager) => toManagerDto(manager, countById.get(manager.id) ?? 0));
  },

  async getManager(id: string): Promise<ManagerDto> {
    const manager = await managerRepository.findById(id);
    if (!manager) {
      throw new NotFoundError('Manager not found');
    }
    const counts = await managerRepository.affiliateCountsByManager();
    const count = counts.find((c) => c.assignedManagerId === id);
    return toManagerDto(manager, count ? Number(count.count) : 0);
  },

  // Resolved from the JWT, never from a client-supplied id, so a manager can only ever
  // read their own permission set.
  async getOwnProfile(userId: string): Promise<ManagerDto> {
    const manager = await managerRepository.findByUserId(userId);
    if (!manager) {
      throw new NotFoundError('Manager profile not found');
    }
    return this.getManager(manager.id);
  },

  // Same transactional shape as affiliate creation — the MANAGER-role login and the
  // manager profile are created together or not at all.
  async createManager(dto: CreateManagerDto): Promise<ManagerDto> {
    const existing = await AppDataSource.getRepository(User).findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ValidationError('An account with this email already exists');
    }
    if (dto.reportsToId && !(await managerRepository.findById(dto.reportsToId))) {
      throw new ValidationError('The reports-to manager does not exist');
    }

    const managerId = await AppDataSource.transaction(async (entityManager) => {
      const user = await userProvisioningService.createUser(entityManager, {
        email: dto.email,
        password: dto.password,
        role: UserRole.MANAGER,
        status: dto.status,
      });

      const repo = entityManager.getRepository(Manager);
      const manager = await repo.save(
        repo.create({
          userId: user.id,
          publicId: await nextPublicId('MAN', entityManager),
          fullName: dto.fullName,
          managerRole: dto.managerRole,
          phone: dto.phone ?? null,
          skype: dto.skype ?? null,
          telegram: dto.telegram ?? null,
          teams: dto.teams ?? null,
          contactEmail: dto.contactEmail ?? null,
          avatarUrl: dto.avatarUrl ?? null,
          defaultCommissionPercent: dto.defaultCommissionPercent,
          reportsToId: dto.reportsToId ?? null,
          // Nothing ticked unless the admin ticked it — a new manager starts with no
          // capabilities rather than inheriting the admin surface (issue #20).
          permissions: dto.permissions ?? {},
          notes: dto.notes ?? null,
        }),
      );
      return manager.id;
    });

    return this.getManager(managerId);
  },

  async updateManager(id: string, dto: UpdateManagerDto): Promise<ManagerDto> {
    const manager = await managerRepository.findById(id);
    if (!manager) {
      throw new NotFoundError('Manager not found');
    }
    // A manager reporting to themselves would make the org chart cyclic at depth 1.
    if (dto.reportsToId === id) {
      throw new ValidationError('A manager cannot report to themselves');
    }
    if (dto.reportsToId && !(await managerRepository.findById(dto.reportsToId))) {
      throw new ValidationError('The reports-to manager does not exist');
    }

    await managerRepository.update(id, {
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.managerRole !== undefined && { managerRole: dto.managerRole }),
      ...(dto.phone !== undefined && { phone: dto.phone ?? null }),
      ...(dto.skype !== undefined && { skype: dto.skype ?? null }),
      ...(dto.telegram !== undefined && { telegram: dto.telegram ?? null }),
      ...(dto.teams !== undefined && { teams: dto.teams ?? null }),
      ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail ?? null }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl ?? null }),
      ...(dto.defaultCommissionPercent !== undefined && { defaultCommissionPercent: dto.defaultCommissionPercent }),
      ...(dto.reportsToId !== undefined && { reportsToId: dto.reportsToId ?? null }),
      // Replaced wholesale, not merged: the checkbox grid always submits the complete
      // set, so a merge would make un-ticking a permission impossible.
      ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
    });
    return this.getManager(id);
  },

  async updateStatus(id: string, dto: UpdateManagerStatusDto): Promise<ManagerDto> {
    const manager = await managerRepository.findById(id);
    if (!manager) {
      throw new NotFoundError('Manager not found');
    }
    await AppDataSource.getRepository(User).update({ id: manager.userId }, { status: dto.status });
    return this.getManager(id);
  },

  /**
   * The contact card an affiliate sees in their sidebar (issue #6).
   *
   * Always resolves to something. An affiliate with no manager — or one whose manager
   * is no longer active, since pointing someone at a suspended colleague is worse than
   * pointing them at the network — gets the support desk instead. That keeps the
   * sidebar card identical for every affiliate rather than degrading to a paragraph
   * for the majority who sit under the admin directly.
   */
  async getContactForAffiliate(assignedManagerId: string | null): Promise<AffiliateManagerContactDto> {
    if (assignedManagerId) {
      const manager = await managerRepository.findById(assignedManagerId);
      if (manager && manager.user?.status === UserStatus.ACTIVE) {
        return toManagerContactDto(manager);
      }
    }
    const settings = await networkSettingService.getSettings();
    return toSupportContactDto(settings.networkName, settings.supportEmail, settings.supportTelegram);
  },
};
