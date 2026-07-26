import express, { type Express } from 'express';
import cors, { type CorsOptions } from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './common/env';
import { errorHandler } from './common/error-handler';
import { logger } from './common/logger';

// Build the cors options from the configured allowlist. An empty allowlist reflects the
// request origin (`origin: true`) — convenient in local dev; production requires an
// explicit list (enforced in env.ts). `credentials` is on so the browser may send the
// Authorization header / cookies.
export function buildCorsOptions(allowlist: string[]): CorsOptions {
  return {
    origin: allowlist.length === 0 ? true : allowlist,
    credentials: true,
  };
}

interface CreateAppOptions {
  // Whether to parse JSON request bodies. Off on the Tracker, whose endpoints are
  // query-only — keeping the body parser off that hot path avoids unnecessary work
  // and shrinks the attack surface on the fast redirect route.
  json?: boolean;
  // Whether to enable browser CORS. On for the main API (the Admin + Affiliate
  // portals call it cross-origin); off on the Tracker (hit via a 302 redirect or
  // server-to-server postback, never fetched from a browser page).
  cors?: boolean;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const { json = true, cors: enableCors = true } = options;
  const app = express();

  // Honor X-Forwarded-For so `req.ip` is the real client behind a proxy/LB.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(pinoHttp({ logger }));
  if (enableCors) {
    app.use(cors(buildCorsOptions(env.CORS_ORIGIN)));
  }
  if (json) {
    app.use(express.json());
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

// Call after all feature routes are mounted — Express error handlers only catch
// errors from middleware/routes registered before them.
export function attachErrorHandler(app: Express): void {
  app.use(errorHandler);
}
