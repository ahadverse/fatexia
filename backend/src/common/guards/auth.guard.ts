import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../jwt';
import { UnauthorizedError } from '../errors';
import type { UserRole } from '../../modules/users/user.entity';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: UserRole };
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing access token'));
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}
