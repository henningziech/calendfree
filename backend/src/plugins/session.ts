import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import { redis } from '../redis.js';
import { config } from '../config.js';
import type { SessionUser } from '@calendfree/shared';

// Extend Fastify session type
declare module '@fastify/session' {
  interface FastifySessionObject {
    user?: SessionUser;
    oauthState?: string;
  }
}

/**
 * Custom Redis session store compatible with @fastify/session.
 * We implement the store interface directly instead of using connect-redis
 * (which is designed for express-session and has type incompatibilities).
 */
class RedisSessionStore {
  private prefix = 'sess:';

  async get(sid: string, callback: (err: any, session?: any) => void) {
    try {
      const data = await redis.get(this.prefix + sid);
      callback(null, data ? JSON.parse(data) : null);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, session: any, callback: (err?: any) => void) {
    try {
      const ttl = session.cookie?.maxAge ? Math.ceil(session.cookie.maxAge / 1000) : 86400;
      await redis.setex(this.prefix + sid, ttl, JSON.stringify(session));
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async destroy(sid: string, callback: (err?: any) => void) {
    try {
      await redis.del(this.prefix + sid);
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

export default fp(async function sessionPlugin(app) {
  await app.register(cookie);
  await app.register(session, {
    secret: config.SESSION_SECRET,
    store: new RedisSessionStore() as any,
    cookie: {
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    saveUninitialized: false,
  });
});
