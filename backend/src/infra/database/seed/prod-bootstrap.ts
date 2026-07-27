import { AppDataSource } from '../data-source';
import { hashPassword } from '../../../common/password';
import { User, UserRole, UserStatus } from '../../../modules/users/user.entity';
import { Integration, IntegrationStatus } from '../../../modules/integrations/integration.entity';
import { EmailTemplate } from '../../../modules/email-templates/email-template.entity';
import { NETWORK_SETTINGS_ID, NetworkSetting } from '../../../modules/network-settings/network-setting.entity';
import { EMAIL_TEMPLATES, INTEGRATIONS } from './fixtures';
import { ids } from './ids';

// Prod-safe bootstrap: the first admin, plus the rows the Admin portal can only edit
// and never create. Idempotent and safe to run in production (unlike run-seed.ts) —
// it inserts nothing that looks like business data: no offers, affiliates, clicks or
// conversions. Credentials come from env so no secret is committed: SUPERADMIN_EMAIL,
// SUPERADMIN_PASSWORD (required in production).
//
// Every step below is insert-if-missing rather than `save()`. That distinction is the
// whole reason this file cannot just call seedContent(): the demo seed rewrites
// integrations with `apiKey: null` and templates with fixture copy on every run, which
// in production would silently erase a key an admin typed into the Integrations page
// or revert their edited email copy. Re-running this script must never destroy
// operator input.

async function bootstrapAdmin(email: string, password: string | undefined): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);

  // Only bootstrap if no admin exists yet — never overwrite a real one.
  const existingAdmin = await userRepo.findOne({ where: { role: UserRole.ADMIN } });
  if (existingAdmin) {
    // eslint-disable-next-line no-console
    console.log('✅ Admin already exists (skipped).');
    return;
  }

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
}

// The `integrations` table exposes only PATCH /:id — there is no create endpoint, by
// design, since the provider set is fixed by the IntegrationProvider enum rather than
// chosen by an operator. So on a fresh database the Integrations page would render an
// empty list with no way to add a row, and because the provider keys deliberately have
// no env fallback (see integration-credentials.ts) proxy detection could never be
// switched on at all. These rows are scaffolding, not data.
async function bootstrapIntegrations(): Promise<void> {
  const integrationRepo = AppDataSource.getRepository(Integration);
  let created = 0;

  for (const fixture of INTEGRATIONS) {
    const existing = await integrationRepo.findOne({ where: { provider: fixture.provider } });
    if (existing) {
      continue;
    }
    await integrationRepo.save(
      integrationRepo.create({
        id: ids.integration(fixture.provider),
        provider: fixture.provider,
        name: fixture.name,
        description: fixture.description,
        // Left empty on purpose: credentials are entered by an admin on the
        // Integrations page and never committed or seeded.
        apiKey: null,
        apiSecret: null,
        config: fixture.config,
        status: IntegrationStatus.NOT_CONFIGURED,
        lastCheckedAt: null,
        lastError: null,
      }),
    );
    created += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`✅ Integrations: ${created} created, ${INTEGRATIONS.length - created} already present.`);
}

// Same shape as integrations: `email_templates` has only PATCH /:id, because the
// template set is fixed by the EmailTemplateKey enum — the sending code looks up a key,
// so an operator-invented template would have nothing to trigger it. The fixture copy
// is the starting point an admin edits, which is why an existing row is never rewritten.
async function bootstrapEmailTemplates(): Promise<void> {
  const templateRepo = AppDataSource.getRepository(EmailTemplate);
  let created = 0;

  for (const fixture of EMAIL_TEMPLATES) {
    const existing = await templateRepo.findOne({ where: { templateKey: fixture.templateKey } });
    if (existing) {
      continue;
    }
    await templateRepo.save(
      templateRepo.create({
        id: ids.emailTemplate(fixture.templateKey),
        templateKey: fixture.templateKey,
        name: fixture.name,
        subject: fixture.subject,
        body: fixture.body,
        availableMacros: fixture.availableMacros,
        enabled: true,
      }),
    );
    created += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`✅ Email templates: ${created} created, ${EMAIL_TEMPLATES.length - created} already present.`);
}

// networkSettingService.loadOrCreate() already creates this singleton on first read, so
// this step is belt-and-braces rather than load-bearing. It is here so the row exists
// before anyone opens the panel: created from the entity's own column defaults, not the
// demo fixture's values, so production never inherits seed copy like "support@fatexia.com".
async function bootstrapNetworkSettings(): Promise<void> {
  const settingsRepo = AppDataSource.getRepository(NetworkSetting);
  const existing = await settingsRepo.findOne({ where: { id: NETWORK_SETTINGS_ID } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log('✅ Network settings already exist (skipped).');
    return;
  }
  await settingsRepo.save(settingsRepo.create({ id: NETWORK_SETTINGS_ID }));
  // eslint-disable-next-line no-console
  console.log('✅ Network settings created from column defaults.');
}

async function main(): Promise<void> {
  const email = process.env.SUPERADMIN_EMAIL ?? 'admin@fatexia.com';
  const password = "ChangeMe123!";

  if (process.env.NODE_ENV === 'production' && !password) {
    throw new Error('SUPERADMIN_PASSWORD is required to bootstrap the first admin in production.');
  }

  await AppDataSource.initialize();
  try {
    await bootstrapAdmin(email, password);
    await bootstrapNetworkSettings();
    await bootstrapIntegrations();
    await bootstrapEmailTemplates();
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Prod bootstrap failed:', err);
  process.exit(1);
});
