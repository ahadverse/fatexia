import type { NextFunction, Response } from 'express';
import { ForbiddenError } from '../errors';
import type { UserRole } from '../../modules/users/user.entity';
import type { AuthenticatedRequest } from './auth.guard';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient role'));
      return;
    }
    next();
  };
}
