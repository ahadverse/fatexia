import { z } from 'zod';
import { IntegrationProvider, IntegrationStatus, type Integration } from './integration.entity';

// A blank string means "leave the stored secret unchanged" — the UI renders a masked
// preview and only sends a value when the admin actually types a new one. Without
// this, every save of an unrelated field would wipe the credential.
export const updateIntegrationSchema = z.object({
  apiKey: z.string().max(500).optional(),
  apiSecret: z.string().max(500).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.nativeEnum(IntegrationStatus).optional(),
});

export type UpdateIntegrationDto = z.infer<typeof updateIntegrationSchema>;

export interface IntegrationDto {
  id: string;
  provider: IntegrationProvider;
  name: string;
  description: string | null;
  // Never the raw secret — a last-4 preview is enough to confirm which key is loaded.
  apiKeyPreview: string | null;
  apiSecretPreview: string | null;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  config: Record<string, unknown>;
  status: IntegrationStatus;
  lastCheckedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

// Short secrets are masked entirely rather than partially — showing 3 of 4 characters
// would leak most of the value.
function mask(secret: string | null): string | null {
  if (!secret) return null;
  if (secret.length <= 8) return '••••••••';
  return `••••••••${secret.slice(-4)}`;
}

export function toIntegrationDto(integration: Integration): IntegrationDto {
  return {
    id: integration.id,
    provider: integration.provider,
    name: integration.name,
    description: integration.description,
    apiKeyPreview: mask(integration.apiKey),
    apiSecretPreview: mask(integration.apiSecret),
    hasApiKey: Boolean(integration.apiKey),
    hasApiSecret: Boolean(integration.apiSecret),
    config: integration.config ?? {},
    status: integration.status,
    lastCheckedAt: integration.lastCheckedAt?.toISOString() ?? null,
    lastError: integration.lastError,
    updatedAt: integration.updatedAt.toISOString(),
  };
}
