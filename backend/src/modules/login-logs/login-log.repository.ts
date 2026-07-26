import { AppDataSource } from '../../infra/database/data-source';
import { LoginLog } from './login-log.entity';

const repository = AppDataSource.getRepository(LoginLog);

export const loginLogRepository = {
  create(data: {
    userId: string | null;
    ip: string;
    userAgent: string | null;
    success: boolean;
    reason: string | null;
  }): Promise<LoginLog> {
    return repository.save(repository.create(data));
  },
};
