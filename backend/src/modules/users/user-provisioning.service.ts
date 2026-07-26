import type { EntityManager } from 'typeorm';
import { hashPassword } from '../../common/password';
import { User, UserRole, UserStatus } from './user.entity';

interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
}

// The one real shared piece of logic across authService.register and any future
// admin-provisioning flow (creating an Affiliate/Manager). Deliberately not a generic
// "create user + profile" abstraction — each caller still creates its own profile row
// (Affiliate/Manager) in the same transaction.
export const userProvisioningService = {
  async createUser(manager: EntityManager, data: CreateUserInput): Promise<User> {
    const passwordHash = await hashPassword(data.password);
    const repository = manager.getRepository(User);
    return repository.save(
      repository.create({
        email: data.email,
        passwordHash,
        role: data.role,
        status: data.status,
      }),
    );
  },
};
