import { comparePassword, hashPassword } from '../../common/password';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../common/errors';
import { userRepository } from './user.repository';
import { toPublicUser, type PublicUserDto } from './user.dto';
import { UserRole } from './user.entity';

interface RequestUser {
  id: string;
  role: UserRole;
}

export const userService = {
  async getUser(requester: RequestUser, id: string): Promise<PublicUserDto> {
    if (requester.role !== UserRole.ADMIN && requester.id !== id) {
      throw new ForbiddenError('Cannot view another user');
    }
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return toPublicUser(user);
  },

  async changePassword(requester: RequestUser, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(requester.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Current password is incorrect');
    }
    await userRepository.updatePassword(user.id, await hashPassword(newPassword));
  },
};
