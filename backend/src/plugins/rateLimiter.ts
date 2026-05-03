import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type RedisLib from 'ioredis';

const RATE_LIMIT_INFO_RPM = parseInt(process.env.RATE_LIMIT_INFO_RPM || '20', 10);
const RATE_LIMIT_MAX_CONCURRENT = parseInt(process.env.RATE_LIMIT_MAX_CONCURRENT || '5', 10);
const CONCURRENT_JOB_TTL = 3600; // 1 hour TTL as safety net

export function getClientIp(req: FastifyRequest): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp) return cfIp;
  if (Array.isArray(cfIp) && cfIp[0]) return cfIp[0];
  return req.ip;
}

export function concurrentJobKey(ip: string): string {
  return `vd:concurrent:${ip}`;
}

export async function checkAndIncrementConcurrentJobs(
  redis: RedisLib.default,
  ip: string,
): Promise<boolean> {
  // Returns true if the job can proceed, false if limit exceeded
  const key = concurrentJobKey(ip);
  const current = await redis.get(key);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= RATE_LIMIT_MAX_CONCURRENT) {
    return false;
  }
  // Increment atomically
  const newCount = await redis.incr(key);
  if (newCount === 1) {
    // Set TTL on first increment
    await redis.expire(key, CONCURRENT_JOB_TTL);
  }
  return true;
}

export async function decrementConcurrentJobs(redis: RedisLib.default, ip: string): Promise<void> {
  const key = concurrentJobKey(ip);
  const current = await redis.get(key);
  if (current && parseInt(current, 10) > 0) {
    await redis.decr(key);
  }
}

async function rateLimiterPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    global: false, // apply per-route
    redis: (fastify as any).redis, // ioredis instance registered on fastify
    keyGenerator: (req: FastifyRequest) => getClientIp(req),
    errorResponseBuilder: (req: FastifyRequest, context: any) => {
      fastify.log.warn({
        msg: 'Rate limit exceeded',
        ip: getClientIp(req),
        path: req.url,
        timestamp: new Date().toISOString(),
      });
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Too many requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
      };
    },
  });
}

export default fp(rateLimiterPlugin, { name: 'rate-limiter' });

export { RATE_LIMIT_INFO_RPM, RATE_LIMIT_MAX_CONCURRENT };
