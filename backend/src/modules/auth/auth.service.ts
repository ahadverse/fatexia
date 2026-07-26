import { AppDataSource } from '../../infra/database/data-source';
import { comparePassword, compareWithDummy } from '../../common/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/jwt';
import { UnauthorizedError, ValidationError } from '../../common/errors';
import { userRepository } from '../users/user.repository';
import { userProvisioningService } from '../users/user-provisioning.service';
import { toPublicUser, type PublicUserDto } from '../users/user.dto';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { Affiliate } from '../affiliates/affiliate.entity';
import { loginLogService } from '../login-logs/login-log.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import type { RegisterDto } from './auth.dto';

interface LoginContext {
  ip: string;
  userAgent: string | null;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const STATUS_REASONS: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: '',
  [UserStatus.PENDING]: 'Account is pending approval',
  [UserStatus.BLOCKED]: 'Account is blocked',
  [UserStatus.REJECTED]: 'Account application was rejected',
  [UserStatus.INACTIVE]: 'Account is inactive',
};

function issueTokens(user: User): TokenPair {
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken: signRefreshToken({ sub: user.id }),
  };
}

export const authService = {
  async register(dto: RegisterDto): Promise<PublicUserDto> {
    const existing = await userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ValidationError('Email is already registered');
    }

    const user = await AppDataSource.transaction(async (manager) => {
      const createdUser = await userProvisioningService.createUser(manager, {
        email: dto.email,
        password: dto.password,
        role: UserRole.AFFILIATE,
        status: UserStatus.PENDING,
      });

      await manager.getRepository(Affiliate).save(
        manager.getRepository(Affiliate).create({
          userId: createdUser.id,
          fullName: dto.fullName,
          country: dto.country,
          messengerType: dto.messengerType,
          messengerHandle: dto.messengerHandle,
          trafficSources: dto.trafficSources,
          websiteUrl: dto.websiteUrl ?? null,
          companyName: dto.companyName ?? null,
          phone: dto.phone ?? null,
          verticals: dto.verticals ?? null,
          monthlyVolume: dto.monthlyVolume ?? null,
          referralSource: dto.referralSource ?? null,
          notes: dto.notes ?? null,
        }),
      );

      return createdUser;
    });

    // Emitted after the transaction commits, never inside it: a notification failure
    // must not roll back a registration that genuinely succeeded.
    notificationService.safeNotify(
      notificationService.notifyNetwork({
        level: NotificationLevel.INFO,
        category: NotificationCategory.AFFILIATE,
        title: 'New affiliate application',
        body: `${dto.fullName} (${dto.country}) applied and is awaiting review.`,
        link: '/affiliates/pending',
      }),
    );

    return toPublicUser(user);
  },

  async login(email: string, password: string, ctx: LoginContext): Promise<TokenPair> {
    const user = await userRepository.findByEmail(email);

    // Always perform exactly one bcrypt comparison — a real one when the user exists,
    // a dummy one when it doesn't — so timing can't reveal whether the email is
    // registered. Both failure paths return the same generic error.
    const passwordValid = user ? await comparePassword(password, user.passwordHash) : await compareWithDummy(password);

    if (!user || !passwordValid) {
      await loginLogService.record({
        userId: user?.id ?? null,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        success: false,
        reason: 'Invalid credentials',
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      const reason = STATUS_REASONS[user.status];
      await loginLogService.record({
        userId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        success: false,
        reason,
      });
      throw new UnauthorizedError(reason);
    }

    await userRepository.updateLastLogin(user.id);
    await loginLogService.record({
      userId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      success: true,
      reason: undefined,
    });

    return issueTokens(user);
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    let userId: string;
    try {
      userId = verifyRefreshToken(refreshToken).sub;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await userRepository.findById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Account is no longer active');
    }

    return issueTokens(user);
  },

  async me(userId: string): Promise<PublicUserDto> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    return toPublicUser(user);
  },
};
