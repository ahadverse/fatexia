import { ValidationError, NotFoundError } from '../../common/errors';
import { probeProvider } from '../fraud/proxy-detection';
import { probeBrevoAccount } from '../../infra/email/brevo-mailer';
import { integrationRepository } from './integration.repository';
import { IntegrationProvider, IntegrationStatus } from './integration.entity';
import { invalidateIntegrationCache } from './integration-credentials';
import { toIntegrationDto, type IntegrationDto, type UpdateIntegrationDto } from './integration.dto';

// Providers whose credentials this service can actually exercise. A "test" button
// that silently no-ops for the rest would be worse than not offering one.
const TESTABLE = new Set<IntegrationProvider>([
  IntegrationProvider.IPHUB,
  IntegrationProvider.IPAPI_IS,
  IntegrationProvider.IPQS,
  IntegrationProvider.SMTP,
]);

// A stable, publicly-known datacenter IP (Google DNS). Every provider recognises it,
// so a failed lookup means the credential or the endpoint is wrong — not the input.
const PROBE_IP = '8.8.8.8';

export const integrationService = {
  async getIntegrations(): Promise<IntegrationDto[]> {
    const integrations = await integrationRepository.findAll();
    return integrations.map(toIntegrationDto);
  },

  async getIntegration(id: string): Promise<IntegrationDto> {
    const integration = await integrationRepository.findById(id);
    if (!integration) {
      throw new NotFoundError('Integration not found');
    }
    return toIntegrationDto(integration);
  },

  async updateIntegration(id: string, dto: UpdateIntegrationDto): Promise<IntegrationDto> {
    const integration = await integrationRepository.findById(id);
    if (!integration) {
      throw new NotFoundError('Integration not found');
    }

    // Only a non-empty string replaces a stored secret; an omitted or blank field
    // leaves it alone (see the note on updateIntegrationSchema).
    const nextApiKey = dto.apiKey ? dto.apiKey : integration.apiKey;
    const nextApiSecret = dto.apiSecret ? dto.apiSecret : integration.apiSecret;

    // Status follows whether a credential is actually present, unless the admin set
    // it explicitly — a provider with no key can't be ACTIVE.
    const derivedStatus = nextApiKey ? IntegrationStatus.ACTIVE : IntegrationStatus.NOT_CONFIGURED;

    await integrationRepository.update(id, {
      apiKey: nextApiKey,
      apiSecret: nextApiSecret,
      ...(dto.config !== undefined && { config: dto.config }),
      status: dto.status ?? derivedStatus,
      lastError: null,
    });

    // The fraud pipeline caches resolved credentials for a short TTL — drop the entry
    // so a key saved here takes effect on the very next click rather than up to a
    // minute later.
    invalidateIntegrationCache(integration.provider);

    return this.getIntegration(id);
  },

  /**
   * Makes a real call to the provider with the stored credential and records the
   * result on the row.
   *
   * Runs through `probeProvider`, the same function the click path uses, so a green
   * result means the click path will genuinely work — a test that used its own
   * request would only prove that the test works.
   */
  async testIntegration(id: string): Promise<IntegrationDto> {
    const integration = await integrationRepository.findById(id);
    if (!integration) {
      throw new NotFoundError('Integration not found');
    }
    if (!TESTABLE.has(integration.provider)) {
      throw new ValidationError(`${integration.name} has no connection test`);
    }
    if (!integration.apiKey) {
      throw new ValidationError('Save an API key before testing the connection');
    }

    try {
      // Brevo has no IP to classify — it gets its own probe (hits the account
      // endpoint) rather than being forced through the fraud-provider signature.
      if (integration.provider === IntegrationProvider.SMTP) {
        const account = await probeBrevoAccount(integration.apiKey);
        await integrationRepository.update(id, {
          status: IntegrationStatus.ACTIVE,
          lastCheckedAt: new Date(),
          lastError: null,
          config: { ...(integration.config ?? {}), lastTestAccount: account },
        });
      } else {
        const isProxy = await probeProvider(integration.provider, integration.apiKey, PROBE_IP);
        await integrationRepository.update(id, {
          status: IntegrationStatus.ACTIVE,
          lastCheckedAt: new Date(),
          lastError: null,
          config: {
            ...(integration.config ?? {}),
            // Recorded so the UI can show that the answer was a real classification and
            // not just a 200 — 8.8.8.8 is a datacenter IP, so `true` is the expected
            // answer and `false` hints the provider is answering but not scoring.
            lastTestIp: PROBE_IP,
            lastTestFlagged: isProxy,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      await integrationRepository.update(id, {
        status: IntegrationStatus.ERROR,
        lastCheckedAt: new Date(),
        lastError: message,
      });
      // Not rethrown: the failure is the answer, and it is now on the row for the UI
      // to render rather than a toast the admin has to remember.
    }

    invalidateIntegrationCache(integration.provider);
    return this.getIntegration(id);
  },
};
