import { loginLogRepository } from './login-log.repository';

export const loginLogService = {
  record(params: { userId: string | null; ip: string; userAgent: string | null; success: boolean; reason?: string }): Promise<void> {
    return loginLogRepository.create({ ...params, reason: params.reason ?? null }).then(() => undefined);
  },
};
