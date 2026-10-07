import { createServer } from 'node:http';
import { createApp, attachErrorHandler } from './app';
import { env } from './common/env';
import { logger } from './common/logger';
import { AppDataSource } from './infra/database/data-source';
import { initRealtime, subscribeToBridgedEmits } from './infra/realtime/socket-server';
import { mountMainRoutes } from './routes';
import { emailCampaignService } from './modules/email-campaigns/email-campaign.service';

async function bootstrap(): Promise<void> {
  await AppDataSource.initialize();

  const app = createApp();

  mountMainRoutes(app);

  attachErrorHandler(app);

  // Express is wrapped in an explicit http server so Socket.IO can share the port —
  // one origin for the portals to talk to, and no second listener to configure.
  const httpServer = createServer(app);
  initRealtime(httpServer);
  // This process owns the sockets, so it is also the one that delivers what the Tracker
  // publishes — a conversion from an advertiser's postback is written over there.
  subscribeToBridgedEmits();

  // Pick up any broadcast a restart cut off; its recipient queue is in the database.
  // Caught so a database that has not run the campaign migration yet logs and carries
  // on instead of taking the whole API down with an unhandled rejection.
  emailCampaignService.resumeInterrupted().catch((err: unknown) => {
    logger.error({ err }, 'Could not resume email campaigns — has the EmailCampaigns migration been run?');
  });

  httpServer.listen(env.PORT, () => {
    logger.info(`Fatexia backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start backend');
  process.exit(1);
});
