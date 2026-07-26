import { createServer } from 'node:http';
import { createApp, attachErrorHandler } from './app';
import { env } from './common/env';
import { logger } from './common/logger';
import { AppDataSource } from './infra/database/data-source';
import { initRealtime } from './infra/realtime/socket-server';
import { mountMainRoutes } from './routes';

async function bootstrap(): Promise<void> {
  await AppDataSource.initialize();

  const app = createApp();

  mountMainRoutes(app);

  attachErrorHandler(app);

  // Express is wrapped in an explicit http server so Socket.IO can share the port —
  // one origin for the portals to talk to, and no second listener to configure.
  const httpServer = createServer(app);
  initRealtime(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`Fatexia backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start backend');
  process.exit(1);
});
