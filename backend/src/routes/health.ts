import type { FastifyInstance } from 'fastify';
import { downloadQueue } from '../workers/downloadWorker.js';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_req, reply) => {
    const waiting = await downloadQueue.getWaitingCount();
    const active = await downloadQueue.getActiveCount();

    return reply.send({
      status: 'ok',
      queue: { waiting, active },
    });
  });
}
