import { AppDataSource } from '../../infra/database/data-source';
import { EmailTemplate, type EmailTemplateKey } from './email-template.entity';

const repository = AppDataSource.getRepository(EmailTemplate);

export const emailTemplateRepository = {
  findAll(): Promise<EmailTemplate[]> {
    return repository.find({ order: { name: 'ASC' } });
  },

  findById(id: string): Promise<EmailTemplate | null> {
    return repository.findOne({ where: { id } });
  },

  // The lookup every trigger site uses — templateKey is stable even if the template
  // is renamed, see the entity comment.
  findByKey(templateKey: EmailTemplateKey): Promise<EmailTemplate | null> {
    return repository.findOne({ where: { templateKey } });
  },

  async update(id: string, fields: Partial<EmailTemplate>): Promise<void> {
    await repository.update({ id }, fields);
  },
};
