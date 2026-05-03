import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { downloadQueue } from '../workers/downloadWorker';

interface ProgressParams {
  jobId: string;
}

export default async function progressRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: ProgressParams }>(
    '/api/jobs/:jobId/progress',
    async (req: FastifyRequest<{ Params: ProgressParams }>, reply: FastifyReply) => {
      const { jobId } = req.params;

      // Verify job exists
      const job = await downloadQueue.getJob(jobId);
      if (!job) {
        return reply.status(404).send({ error: 'JOB_NOT_FOUND', message: 'Job not found.' });
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sendEvent = (data: object) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Check if job is already complete or failed
      const state = await job.getState();
      if (state === 'completed') {
        const progress = job.progress();
        sendEvent(
          typeof progress === 'object' && progress !== null
            ? progress
            : { stage: 'complete', percent: 100, fileReady: true },
        );
        reply.raw.end();
        return;
      }
      if (state === 'failed') {
        sendEvent({ stage: 'error', message: 'Download failed. Please retry.' });
        reply.raw.end();
        return;
      }

      // Subscribe to Bull queue events
      const onProgress = (completedJob: { id: string | number }, data: unknown) => {
        if (String(completedJob.id) !== jobId) return;
        sendEvent(data as object);
      };

      const onCompleted = (completedJob: { id: string | number }) => {
        if (String(completedJob.id) !== jobId) return;
        sendEvent({ stage: 'complete', percent: 100, fileReady: true });
        cleanup();
        reply.raw.end();
      };

      const onFailed = (failedJob: { id: string | number }) => {
        if (String(failedJob.id) !== jobId) return;
        sendEvent({ stage: 'error', message: 'Download failed. Please retry.' });
        cleanup();
        reply.raw.end();
      };

      // Bull v4 event signatures: (job, progress), (job), (job, error)
      downloadQueue.on('progress', onProgress as (...args: unknown[]) => void);
      downloadQueue.on('completed', onCompleted as (...args: unknown[]) => void);
      downloadQueue.on('failed', onFailed as (...args: unknown[]) => void);

      const cleanup = () => {
        downloadQueue.removeListener('progress', onProgress as (...args: unknown[]) => void);
        downloadQueue.removeListener('completed', onCompleted as (...args: unknown[]) => void);
        downloadQueue.removeListener('failed', onFailed as (...args: unknown[]) => void);
      };

      req.raw.on('close', cleanup);
    },
  );
}
