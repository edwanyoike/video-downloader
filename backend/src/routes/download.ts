import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateUrl } from '../lib/urlValidator.js';
import { verifyTurnstileToken } from '../lib/turnstile.js';
import { getClientIp, checkAndIncrementConcurrentJobs } from '../plugins/rateLimiter.js';
import { downloadQueue } from '../workers/downloadWorker.js';
import type { DownloadJobData } from '../types.js';
import type RedisLib from 'ioredis';

interface DownloadBody {
  url: string;
  formatId: string;
  platformId?: string;
  turnstileToken: string;
  options?: {
    subtitleLang?: string;
    subtitleFormat?: 'srt' | 'vtt';
    noWatermark?: boolean;
  };
  title?: string;
}

export default async function downloadRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: DownloadBody }>(
    '/api/download',
    {
      schema: {
        body: {
          type: 'object',
          required: ['url', 'formatId'],
          properties: {
            url: { type: 'string' },
            formatId: { type: 'string' },
            platformId: { type: 'string' },
            turnstileToken: { type: 'string' },
            title: { type: 'string' },
            options: { type: 'object' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: DownloadBody }>, reply: FastifyReply) => {
      const { url, formatId, platformId, turnstileToken, options = {}, title = '' } = req.body;
      const clientIp = getClientIp(req);

      // 1. Verify Turnstile token (skip if token is empty — Turnstile not configured on frontend)
      if (turnstileToken) {
        const turnstileValid = await verifyTurnstileToken(turnstileToken, clientIp);
        if (!turnstileValid) {
          return reply.status(403).send({
            error: 'TURNSTILE_FAILED',
            message: 'Bot check failed. Please try again.',
          });
        }
      }

      // 2. Check concurrent job limit
      const redis = (fastify as unknown as { redis: RedisLib.default }).redis;
      const canProceed = await checkAndIncrementConcurrentJobs(redis, clientIp);
      if (!canProceed) {
        return reply.status(429).send({
          error: 'TOO_MANY_JOBS',
          message: 'You have too many active downloads. Please wait for one to complete.',
        });
      }

      // 3. Validate URL
      const validation = await validateUrl(url, platformId);
      if (!validation.valid) {
        return reply.status(400).send({
          error: validation.error,
          message: validation.errorMessage,
        });
      }

      // 4. Enqueue download job
      try {
        const jobData: DownloadJobData = {
          url: validation.normalizedUrl!,
          platformId: validation.platformId!,
          formatId,
          title,
          clientIp,
          options,
          createdAt: Date.now(),
        };

        const job = await downloadQueue.add(jobData, {
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        });

        return reply.status(202).send({ jobId: job.id });
      } catch (err) {
        fastify.log.error({ err }, 'Failed to enqueue download job');
        return reply.status(500).send({
          error: 'QUEUE_ERROR',
          message: 'Failed to start download. Please try again.',
        });
      }
    },
  );
}
