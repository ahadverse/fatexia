import { AppDataSource } from '../../infra/database/data-source';
import { NotFoundError, ValidationError } from '../../common/errors';
import { User, UserRole } from '../users/user.entity';
import { userProvisioningService } from '../users/user-provisioning.service';
import { Manager } from './manager.entity';
import { managerRepository } from './manager.repository';
import {
  toManagerDto,
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
          fullName: dto.fullName,
          managerRole: dto.managerRole,
          phone: dto.phone ?? null,
          skype: dto.skype ?? null,
          defaultCommissionPercent: dto.defaultCommissionPercent,
          reportsToId: dto.reportsToId ?? null,
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
      ...(dto.defaultCommissionPercent !== undefined && { defaultCommissionPercent: dto.defaultCommissionPercent }),
      ...(dto.reportsToId !== undefined && { reportsToId: dto.reportsToId ?? null }),
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
};
