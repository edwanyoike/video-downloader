import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { downloadQueue, getJobDir } from '../workers/downloadWorker.js';
import { sanitizeFilename } from '../lib/sanitizeFilename.js';
import { getClientIp } from '../plugins/rateLimiter.js';

interface FileParams {
  jobId: string;
}

const FILE_CLEANUP_DELAY_MS = 60_000;

export default async function fileRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: FileParams }>(
    '/api/jobs/:jobId/file',
    async (req: FastifyRequest<{ Params: FileParams }>, reply: FastifyReply) => {
      const { jobId } = req.params;
      const clientIp = getClientIp(req);

      // Verify job exists and belongs to this IP
      const job = await downloadQueue.getJob(jobId);
      if (!job) {
        return reply.status(404).send({ error: 'JOB_NOT_FOUND', message: 'Job not found.' });
      }

      if (job.data.clientIp !== clientIp) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Access denied.' });
      }

      const state = await job.getState();
      if (state !== 'completed') {
        return reply.status(409).send({
          error: 'JOB_NOT_COMPLETE',
          message: 'Download is not yet complete.',
        });
      }

      // Find the output file in the job directory
      const jobDir = getJobDir(jobId);
      let outputFile: string | undefined;
      try {
        const files = await fsPromises.readdir(jobDir);
        outputFile = files.find((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));
      } catch {
        return reply.status(404).send({
          error: 'FILE_NOT_FOUND',
          message: 'File not found or already deleted.',
        });
      }

      if (!outputFile) {
        return reply.status(404).send({
          error: 'FILE_NOT_FOUND',
          message: 'File not found or already deleted.',
        });
      }

      const filePath = path.join(jobDir, outputFile);
      const ext = path.extname(outputFile).slice(1) || 'mp4';
      const titleForFile = job.data.title || outputFile;
      const sanitized = sanitizeFilename(titleForFile, ext);
      // If sanitization stripped everything (hashtag-only titles), use platform + random code
      const finalName = sanitized === `download.${ext.toLowerCase()}`
        ? `${job.data.platformId}-${Math.random().toString(36).slice(2, 8)}.${ext.toLowerCase()}`
        : sanitized;
      const contentType = mime.lookup(filePath) || 'application/octet-stream';

      // Use ASCII-safe fallback + RFC 5987 encoded filename for Unicode support
      const asciiFallback = finalName.replace(/[^\x20-\x7E]/g, '_');
      const encodedName = encodeURIComponent(finalName).replace(/'/g, '%27');

      reply
        .header('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`)
        .header('Content-Type', contentType);

      // Stream the file
      const stream = fs.createReadStream(filePath);
      reply.send(stream);

      // Schedule cleanup after 60s
      setTimeout(() => {
        fsPromises.rm(jobDir, { recursive: true, force: true }).catch(() => {});
      }, FILE_CLEANUP_DELAY_MS);
    },
  );
}
