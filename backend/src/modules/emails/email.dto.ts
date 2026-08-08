import { z } from 'zod';

// Capped deliberately. This is a manual, admin-composed send — a one-by-one loop
// against Brevo's API, not a bulk-campaign endpoint. A large list here would hold the
// request open for a long time and quietly become the network's broadcast tool
// without any of the unsubscribe/bounce handling a real campaign needs.
export const MAX_MANUAL_RECIPIENTS = 25;

const contentShape = {
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  // Macro values, supplied once and applied to every recipient of this send.
  macros: z.record(z.string().max(500)).optional(),
};

export const sendEmailSchema = z.object({
  recipients: z
    .array(z.string().trim().email())
    .min(1, 'Add at least one recipient')
    .max(MAX_MANUAL_RECIPIENTS, `A manual send is limited to ${MAX_MANUAL_RECIPIENTS} recipients`),
  ...contentShape,
});

export type SendEmailDto = z.infer<typeof sendEmailSchema>;

// Same content fields, no recipients — nothing is sent, so there is nobody to send to.
export const previewEmailSchema = z.object(contentShape);

export type PreviewEmailDto = z.infer<typeof previewEmailSchema>;

export interface SendEmailResultDto {
  sent: string[];
  failed: { email: string; error: string }[];
}
