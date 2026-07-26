import { NotFoundError, ValidationError } from '../../common/errors';
import { emailTemplateRepository } from './email-template.repository';
import { toEmailTemplateDto, type EmailTemplateDto, type UpdateEmailTemplateDto } from './email-template.dto';

// A body referencing a macro the template doesn't declare would render the literal
// token in a real customer email, so unknown macros are rejected at save time.
function assertMacrosDeclared(body: string, subject: string, available: string[]): void {
  const used = [...`${subject}\n${body}`.matchAll(/\{([a-z0-9_]+)\}/gi)].map((m) => m[1]!);
  const unknown = [...new Set(used)].filter((macro) => !available.includes(`{${macro}}`));
  if (unknown.length > 0) {
    throw new ValidationError(`Unknown macro(s): ${unknown.map((m) => `{${m}}`).join(', ')}`);
  }
}

export const emailTemplateService = {
  async getTemplates(): Promise<EmailTemplateDto[]> {
    const templates = await emailTemplateRepository.findAll();
    return templates.map(toEmailTemplateDto);
  },

  async getTemplate(id: string): Promise<EmailTemplateDto> {
    const template = await emailTemplateRepository.findById(id);
    if (!template) {
      throw new NotFoundError('Email template not found');
    }
    return toEmailTemplateDto(template);
  },

  async updateTemplate(id: string, dto: UpdateEmailTemplateDto): Promise<EmailTemplateDto> {
    const template = await emailTemplateRepository.findById(id);
    if (!template) {
      throw new NotFoundError('Email template not found');
    }

    const nextSubject = dto.subject ?? template.subject;
    const nextBody = dto.body ?? template.body;
    assertMacrosDeclared(nextBody, nextSubject, template.availableMacros ?? []);

    await emailTemplateRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.subject !== undefined && { subject: dto.subject }),
      ...(dto.body !== undefined && { body: dto.body }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
    });
    return this.getTemplate(id);
  },
};
