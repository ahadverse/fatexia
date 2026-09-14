import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { buildCorsOptions } from '../../app';
import { env } from '../../common/env';
import { logger } from '../../common/logger';
import { verifyAccessToken } from '../../common/jwt';
import { UserRole } from '../../modules/users/user.entity';
import { affiliateRepository } from '../../modules/affiliates/affiliate.repository';
import { redis } from '../redis/redis-client';
import { ROOMS } from './events';

interface SocketUser {
  userId: string;
  role: UserRole;
  affiliateId?: string;
}

// Socket.IO attaches per-connection state to the socket itself; this keeps that
// untyped bag in one declared shape.
type AuthedSocket = Socket & { data: { user?: SocketUser } };

let io: Server | null = null;

/**
 * Authenticates the handshake with the same access token the REST API uses.
 *
 * The token is read from `auth.token` rather than a query parameter so it never
 * lands in an access log or a Referer header. Rejecting here (instead of on the
 * first event) means an unauthenticated socket never reaches a room at all.
 */
async function authenticate(socket: AuthedSocket, next: (err?: Error) => void): Promise<void> {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    next(new Error('Missing access token'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user: SocketUser = { userId: payload.sub, role: payload.role };

    // An affiliate's rooms are keyed by their affiliate record, not their login, so
    // resolve it once at connect time rather than on every emit.
    if (payload.role === UserRole.AFFILIATE) {
      const affiliate = await affiliateRepository.findByUserId(payload.sub);
      if (!affiliate) {
        next(new Error('Affiliate profile not found'));
        return;
      }
      user.affiliateId = affiliate.id;
    }

    socket.data.user = user;
    next();
  } catch {
    next(new Error('Invalid or expired access token'));
  }
}

function joinRooms(socket: AuthedSocket): void {
  const user = socket.data.user;
  if (!user) return;

  void socket.join(ROOMS.user(user.userId));

  if (user.role === UserRole.AFFILIATE && user.affiliateId) {
    void socket.join(ROOMS.affiliate(user.affiliateId));
  } else {
    // Admins and managers share one inbox — a message from any affiliate has to
    // reach whichever staff member is currently looking at it.
    void socket.join(ROOMS.network);
  }
}

export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    // Same allowlist as the REST API — the portals connect from their own origins.
    cors: buildCorsOptions(env.CORS_ORIGIN),
    // The client falls back to polling on networks that block websockets; keeping
    // both transports means realtime still works there, just less efficiently.
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    void authenticate(socket as AuthedSocket, next);
  });

  io.on('connection', (socket) => {
    const authed = socket as AuthedSocket;
    joinRooms(authed);
    logger.debug({ userId: authed.data.user?.userId, role: authed.data.user?.role }, 'Realtime client connected');

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: authed.data.user?.userId, reason }, 'Realtime client disconnected');
    });
  });

  logger.info('Realtime (Socket.IO) ready');
  return io;
}

/**
 * Carries an emit from a process that has no Socket.IO server to the one that does.
 *
 * The Tracker is a separate process (tracking.ts) and the socket server lives on the
 * API's HTTP server, so anything the Tracker wants to announce — a conversion from an
 * advertiser's postback, most of all — has no browser to reach from where it is. Redis
 * is already a dependency of both, so one channel is enough; a Socket.IO Redis adapter
 * would do the same job by pulling in two more packages and taking over the emit path.
 *
 * Fire-and-forget by design. Realtime is a delivery optimisation on top of the database
 * and never the source of truth, so a publish that fails costs a live toast, never the
 * conversion it was announcing.
 */
const BRIDGE_CHANNEL = 'realtime:emit';

interface BridgedEmit {
  room: string;
  event: string;
  payload: unknown;
}

/**
 * Emits to a room, wherever this process happens to be.
 *
 * With a socket server attached the emit is direct; without one it goes over Redis to
 * the process that has it. Still a no-op-ish for the seed scripts and the test suite,
 * which run these services with neither: the publish simply fails and is swallowed.
 */
export function emitToRoom(room: string, event: string, payload: unknown): void {
  if (io) {
    io.to(room).emit(event, payload);
    return;
  }

  redis
    .publish(BRIDGE_CHANNEL, JSON.stringify({ room, event, payload } satisfies BridgedEmit))
    .catch((err: unknown) => logger.debug({ err, event }, 'Could not bridge a realtime emit'));
}

/**
 * Listens for emits published by the other process and delivers them.
 *
 * Called once by the API after initRealtime — it is the only process with sockets to
 * deliver to. Uses its own connection because a client in subscribe mode cannot run
 * ordinary commands, and the shared one is busy doing exactly that.
 */
export function subscribeToBridgedEmits(): void {
  const subscriber = redis.duplicate();

  subscriber.on('error', (err) => logger.warn({ err }, 'Realtime bridge subscriber error'));

  subscriber.subscribe(BRIDGE_CHANNEL).catch((err: unknown) => {
    logger.warn({ err }, 'Could not subscribe to the realtime bridge — Tracker-side events will not reach browsers');
  });

  subscriber.on('message', (_channel, raw) => {
    try {
      const { room, event, payload } = JSON.parse(raw) as BridgedEmit;
      // Straight to io, not back through emitToRoom: a republish here would loop.
      io?.to(room).emit(event, payload);
    } catch (err) {
      logger.warn({ err }, 'Ignored an unreadable realtime bridge message');
    }
  });
}

export function isRealtimeReady(): boolean {
  return io !== null;
}

// Used by tests and graceful shutdown.
export async function closeRealtime(): Promise<void> {
  if (!io) return;
  await io.close();
  io = null;
}
