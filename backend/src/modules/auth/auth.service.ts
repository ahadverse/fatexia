import { createHash, randomBytes, randomInt } from 'node:crypto';
import { AppDataSource } from '../../infra/database/data-source';
import { env } from '../../common/env';
import { comparePassword, compareWithDummy, hashPassword } from '../../common/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/jwt';
import { UnauthorizedError, ValidationError } from '../../common/errors';
import { userRepository } from '../users/user.repository';
import { userProvisioningService } from '../users/user-provisioning.service';
import { toPublicUser, type PublicUserDto } from '../users/user.dto';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { Affiliate } from '../affiliates/affiliate.entity';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { generateReferralCode } from '../affiliates/referral-code';
import { nextPublicId } from '../../common/public-id';
import { loginLogService } from '../login-logs/login-log.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import { sendTemplateEmail, safeSendEmail } from '../../infra/email/brevo-mailer';
import { EmailTemplateKey } from '../email-templates/email-template.entity';
import type { ForgotPasswordDto, RegisterDto, ResendVerificationDto, ResetPasswordDto, VerifyEmailDto } from './auth.dto';

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

/**
 * One hour, and it is the copy in the seeded template that says so.
 *
 * Long enough to survive a mail queue and someone reading it after a meeting, short
 * enough that a link left in an inbox is not a standing key to the account.
 */
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * 32 bytes from the CSPRNG — this is a bearer credential, so it has to be
 * unguessable in a way a six-digit code is not. `base64url` keeps it safe to paste
 * into a query string without escaping.
 */
function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What goes in the database. The raw token exists only in the email. */
function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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

    /**
     * Issue #5's ownership rule for self-registration.
     *
     * Referred through another affiliate's code → the new account joins that
     * affiliate's manager, so a manager keeps the whole tree they recruited. No code
     * (or one nobody recognises) → no manager, which is how "under the admin directly"
     * is stored. An unknown code is not an error: a typo in a shared link should cost
     * the referrer their commission, not cost the applicant their application.
     */
    const referrer = dto.referralCode ? await affiliateRepository.findByReferralCode(dto.referralCode.trim()) : null;

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
          publicId: await nextPublicId('AFF', manager),
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
          referredByAffiliateId: referrer?.id ?? null,
          assignedManagerId: referrer?.assignedManagerId ?? null,
          referralCode: generateReferralCode(),
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

    // Closes the loop the registration email opened. Sent after the write, never
    // before: an email claiming the address is confirmed must not go out if the row
    // failed to update.
    //
    // Fire-and-forget, like every other trigger here — verification has already
    // succeeded by this point, and a mail failure must not turn that into an error
    // the applicant sees and retries with a code that is now consumed.
    const affiliate = await affiliateRepository.findByUserId(user.id);
    safeSendEmail(
      sendTemplateEmail({
        templateKey: EmailTemplateKey.AFFILIATE_VERIFIED,
        to: { email: user.email, name: affiliate?.fullName ?? null },
        macros: { affiliate_name: affiliate?.fullName ?? 'there' },
      }),
    );

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

  /**
   * Starts a password reset. Always resolves the same way.
   *
   * No branch here may leak whether the address is registered — not the return value,
   * not an error, not a status code. The whole point of an unauthenticated endpoint
   * that takes an email is that it is the easiest place in the product to enumerate
   * accounts from, and "we sent you a link" / "no such user" answers that question for
   * free. Same reasoning as `resendVerification` and the dummy bcrypt compare in
   * `login`.
   *
   * Issuing a new token overwrites any previous one, so the most recent link is the
   * only one that works. That matters when someone clicks "forgot password" three
   * times and then opens the first email.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ sent: true }> {
    const user = await userRepository.findByEmail(dto.email);

    // Affiliates only. The reset link points at the affiliate portal, so handing one
    // to an admin or manager would send them somewhere they cannot use it — and their
    // accounts are provisioned by hand, which is also how they are recovered.
    // A blocked or rejected account is excluded too: letting someone regain access to
    // an account the network has closed is not a recovery, and the silence here is
    // indistinguishable from an address that was never registered.
    if (user && user.role === UserRole.AFFILIATE && user.status !== UserStatus.BLOCKED && user.status !== UserStatus.REJECTED) {
      const token = generateResetToken();
      await userRepository.updatePasswordReset(user.id, {
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      });

      const affiliate = await affiliateRepository.findByUserId(user.id);
      safeSendEmail(
        sendTemplateEmail({
          templateKey: EmailTemplateKey.PASSWORD_RESET,
          to: { email: user.email, name: affiliate?.fullName ?? null },
          macros: {
            affiliate_name: affiliate?.fullName ?? 'there',
            // Labelled so the layout renders it as a named button rather than "Open".
            reset_link: `[Set a new password](${env.AFFILIATE_PORTAL_URL}/reset-password?token=${token})`,
          },
        }),
      );
    }

    return { sent: true };
  },

  /**
   * Completes a reset.
   *
   * Unlike `forgotPassword` this one does report failure, and it has to: the person
   * here is holding a link they believe is valid, and "something went wrong" with no
   * reason sends them back to the form to try the same dead link again. It leaks
   * nothing either way — a token is not an email address, and an attacker guessing
   * tokens already knows the guess failed.
   *
   * The token is consumed whether or not it was still in date, so a leaked link
   * cannot be retried against a clock.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ reset: true }> {
    const user = await userRepository.findByPasswordResetTokenHash(hashResetToken(dto.token));
    if (!user || !user.passwordResetExpiresAt) {
      throw new ValidationError('This reset link is not valid. Request a new one.');
    }

    if (user.passwordResetExpiresAt < new Date()) {
      await userRepository.updatePasswordReset(user.id, {
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      });
      throw new ValidationError('This reset link has expired. Request a new one.');
    }

    await userRepository.updatePassword(user.id, await hashPassword(dto.password));
    // Cleared in the same breath as the password changes — this is what makes the
    // link single-use, and it is the step that must not be forgotten.
    await userRepository.updatePasswordReset(user.id, {
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    });

    // Told, not asked: if this reset was not theirs, this notification is how they
    // find out, and it is in the product rather than only in email on purpose.
    notificationService.safeNotify(
      notificationService.notifyUser(user.id, {
        level: NotificationLevel.WARNING,
        category: NotificationCategory.SYSTEM,
        title: 'Your password was changed',
        body: 'If this was not you, contact your manager immediately.',
      }),
    );

    return { reset: true };
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
