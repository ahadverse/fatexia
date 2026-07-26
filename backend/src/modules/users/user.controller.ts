import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { userService } from './user.service';
import type { ChangePasswordDto } from './user.dto';

export const userController = {
  async getUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await userService.getUser(req.user!, req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body as ChangePasswordDto;
      await userService.changePassword(req.user!, currentPassword, newPassword);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
