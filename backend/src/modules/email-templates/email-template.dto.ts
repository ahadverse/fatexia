import { z } from 'zod';
import { EmailTemplateKey, type EmailTemplate } from './email-template.entity';

// templateKey is set at seed time and never editable — the sending code looks
// templates up by it, so allowing a rename would silently break a trigger.
export const updateEmailTemplateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(20000).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateEmailTemplateDto = z.infer<typeof updateEmailTemplateSchema>;

export interface EmailTemplateDto {
  id: string;
  templateKey: EmailTemplateKey;
  name: string;
  subject: string;
  body: string;
  availableMacros: string[];
  enabled: boolean;
  updatedAt: string;
}

export function toEmailTemplateDto(template: EmailTemplate): EmailTemplateDto {
  return {
    id: template.id,
    templateKey: template.templateKey,
    name: template.name,
    subject: template.subject,
    body: template.body,
    availableMacros: template.availableMacros ?? [],
    enabled: template.enabled,
    updatedAt: template.updatedAt.toISOString(),
  };
}
