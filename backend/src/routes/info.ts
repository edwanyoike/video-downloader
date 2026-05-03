import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateUrl } from '../lib/urlValidator';
import { fetchMetadata } from '../extractors/ytdlp';
import { RATE_LIMIT_INFO_RPM } from '../plugins/rateLimiter';
import type { AppError } from '../types';

interface InfoBody {
  url: string;
  platformId?: string;
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

      try {
        const mediaInfo = await fetchMetadata(validation.normalizedUrl!);
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
