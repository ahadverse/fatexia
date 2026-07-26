import { AppDataSource } from '../../infra/database/data-source';
import { EmailTemplate } from './email-template.entity';

const repository = AppDataSource.getRepository(EmailTemplate);

export const emailTemplateRepository = {
  findAll(): Promise<EmailTemplate[]> {
    return repository.find({ order: { name: 'ASC' } });
  },

  findById(id: string): Promise<EmailTemplate | null> {
    return repository.findOne({ where: { id } });
  },

  async update(id: string, fields: Partial<EmailTemplate>): Promise<void> {
    await repository.update({ id }, fields);
  },
};
