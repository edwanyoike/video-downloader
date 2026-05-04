import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type RedisLib from 'ioredis';
import { validateUrl } from '../lib/urlValidator.js';
import { fetchMetadata } from '../extractors/ytdlp.js';
import { RATE_LIMIT_INFO_RPM } from '../plugins/rateLimiter.js';
import type { AppError } from '../types.js';

interface InfoBody {
  url: string;
  platformId?: string;
}

const CACHE_PREFIX = 'vd:info:';
const CACHE_TTL = 3600; // 1 hour

function cacheKey(url: string): string {
  // Simple hash: use the normalized URL as key
  return CACHE_PREFIX + Buffer.from(url).toString('base64url');
}

export default async function infoRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: InfoBody }>(
    '/api/info',
    {
      config: {
        rateLimit: {
          max: RATE_LIMIT_INFO_RPM,
          timeWindow: '1 minute',
        },
      },
      schema: {
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' },
            platformId: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: InfoBody }>, reply: FastifyReply) => {
      const { url, platformId } = req.body;

      // Server-side URL validation + SSRF guard
      const validation = await validateUrl(url, platformId);
      if (!validation.valid) {
        const statusMap: Record<string, number> = {
          MALFORMED: 400,
          UNSUPPORTED_PLATFORM: 400,
          PLATFORM_MISMATCH: 400,
          SSRF_BLOCKED: 400,
        };
        return reply.status(statusMap[validation.error!] || 400).send({
          error: validation.error,
          message: validation.errorMessage,
        });
      }

      const normalizedUrl = validation.normalizedUrl!;
      const redis = (fastify as unknown as { redis: RedisLib.default }).redis;
      const key = cacheKey(normalizedUrl);

      // Check cache first
      try {
        const cached = await redis.get(key);
        if (cached) {
          fastify.log.info({ url: normalizedUrl }, 'Cache hit for /api/info');
          return reply.send(JSON.parse(cached));
        }
      } catch {
        // Redis error — proceed without cache
      }

      try {
        const mediaInfo = await fetchMetadata(normalizedUrl);

        // Cache the result
        try {
          await redis.set(key, JSON.stringify(mediaInfo), 'EX', CACHE_TTL);
        } catch {
          // Redis error — don't fail the request
        }

        return reply.send(mediaInfo);
      } catch (err) {
        const appError = err as AppError;
        if (appError.httpStatus) {
          return reply.status(appError.httpStatus).send({
            error: appError.code,
            message: appError.userMessage,
          });
        }
        fastify.log.error({ err }, 'Unexpected error in /api/info');
        return reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    },
  );
}
