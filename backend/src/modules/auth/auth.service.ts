import { randomInt } from 'node:crypto';
import { AppDataSource } from '../../infra/database/data-source';
import { comparePassword, compareWithDummy } from '../../common/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/jwt';
import { UnauthorizedError, ValidationError } from '../../common/errors';
import { userRepository } from '../users/user.repository';
import { userProvisioningService } from '../users/user-provisioning.service';
import { toPublicUser, type PublicUserDto } from '../users/user.dto';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { Affiliate } from '../affiliates/affiliate.entity';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { loginLogService } from '../login-logs/login-log.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import { sendTemplateEmail, safeSendEmail } from '../../infra/email/brevo-mailer';
import { EmailTemplateKey } from '../email-templates/email-template.entity';
import type { RegisterDto, ResendVerificationDto, VerifyEmailDto } from './auth.dto';

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function sendVerificationCode(email: string, name: string | null, code: string): void {
  safeSendEmail(
    sendTemplateEmail({
      templateKey: EmailTemplateKey.AFFILIATE_WELCOME,
      to: { email, name },
      macros: { affiliate_name: name ?? 'there', code },
    }),
  );
}

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

    const verificationCode = generateVerificationCode();

    const user = await AppDataSource.transaction(async (manager) => {
      const createdUser = await userProvisioningService.createUser(manager, {
        email: dto.email,
        password: dto.password,
        role: UserRole.AFFILIATE,
        status: UserStatus.PENDING,
      });

      // Verification is independent of the PENDING approval status set above (see
      // user.entity.ts) — stored in the same transaction as the account itself.
      await manager.getRepository(User).update(
        { id: createdUser.id },
        {
          emailVerificationCode: verificationCode,
          emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
          emailVerificationAttempts: 0,
        },
      );

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

    // Emitted after the transaction commits, never inside it: a notification/email
    // failure must not roll back a registration that genuinely succeeded.
    notificationService.safeNotify(
      notificationService.notifyNetwork({
        level: NotificationLevel.INFO,
        category: NotificationCategory.AFFILIATE,
        title: 'New affiliate application',
        body: `${dto.fullName} (${dto.country}) applied and is awaiting review.`,
        link: '/affiliates/pending',
      }),
    );
    sendVerificationCode(dto.email, dto.fullName, verificationCode);

    return toPublicUser(user);
  },

  /**
   * Confirms the affiliate owns the email address — a separate concern from the
   * PENDING → ACTIVE approval decision (see user.entity.ts). Never issues tokens:
   * the account may still be PENDING, so login stays gated the same way it always
   * was.
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<{ verified: true }> {
    const user = await userRepository.findByEmail(dto.email);
    if (!user) {
      throw new ValidationError('Invalid code');
    }
    if (user.emailVerifiedAt) {
      return { verified: true };
    }
    if (!user.emailVerificationCode || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new ValidationError('Code expired — request a new one');
    }
    if (user.emailVerificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      throw new ValidationError('Too many attempts — request a new code');
    }
    if (user.emailVerificationCode !== dto.code) {
      await userRepository.updateVerification(user.id, { emailVerificationAttempts: user.emailVerificationAttempts + 1 });
      throw new ValidationError('Invalid code');
    }

    await userRepository.updateVerification(user.id, {
      emailVerifiedAt: new Date(),
      emailVerificationCode: null,
      emailVerificationExpiresAt: null,
      emailVerificationAttempts: 0,
    });
    return { verified: true };
  },

  // Always resolves the same way regardless of whether the email exists or is
  // already verified — no signal for an outside caller to probe registered emails
  // with.
  async resendVerification(dto: ResendVerificationDto): Promise<{ sent: true }> {
    const user = await userRepository.findByEmail(dto.email);
    if (user && !user.emailVerifiedAt) {
      const code = generateVerificationCode();
      await userRepository.updateVerification(user.id, {
        emailVerificationCode: code,
        emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
        emailVerificationAttempts: 0,
      });
      const affiliate = await affiliateRepository.findByUserId(user.id);
      sendVerificationCode(user.email, affiliate?.fullName ?? null, code);
    }
    return { sent: true };
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
