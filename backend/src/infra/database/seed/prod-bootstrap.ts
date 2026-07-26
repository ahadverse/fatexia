import { AppDataSource } from '../data-source';
import { hashPassword } from '../../../common/password';
import { User, UserRole, UserStatus } from '../../../modules/users/user.entity';
import { ids } from './ids';

// Minimal prod-safe bootstrap: just the first admin account. Idempotent, and safe to
// run in production (unlike run-seed.ts). Credentials come from env so no secret is
// committed: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD (required in production), SUPERADMIN_NAME.
async function main(): Promise<void> {
  const email = process.env.SUPERADMIN_EMAIL ?? 'admin@fatexia.com';
  const password = process.env.SUPERADMIN_PASSWORD;

  if (process.env.NODE_ENV === 'production' && !password) {
    throw new Error('SUPERADMIN_PASSWORD is required to bootstrap the first admin in production.');
  }

  await AppDataSource.initialize();
  try {
    const userRepo = AppDataSource.getRepository(User);

    // Only bootstrap if no admin exists yet — never overwrite a real one.
    const existingAdmin = await userRepo.findOne({ where: { role: UserRole.ADMIN } });
    if (!existingAdmin) {
      await userRepo.save(
        userRepo.create({
          id: ids.user(email),
          email,
          passwordHash: await hashPassword(password ?? 'ChangeMe123!'),
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          lastLogin: null,
        }),
      );
      // eslint-disable-next-line no-console
      console.log(`✅ Bootstrapped admin: ${email}`);
    } else {
      // eslint-disable-next-line no-console
      console.log('✅ Admin already exists (skipped).');
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Prod bootstrap failed:', err);
  process.exit(1);
});
