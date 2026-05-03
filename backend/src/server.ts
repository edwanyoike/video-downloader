import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import rateLimiterPlugin from './plugins/rateLimiter';
import securityHeadersPlugin from './plugins/securityHeaders';
import infoRoutes from './routes/info';
import downloadRoutes from './routes/download';
import progressRoutes from './routes/progress';
import fileRoutes from './routes/file';
import healthRoutes from './routes/health';
import { cleanupOrphanedDirs } from './workers/downloadWorker';

dotenv.config();

// Validate required environment variables
const REQUIRED_ENV_VARS = ['REDIS_URL', 'TURNSTILE_SECRET_KEY'];

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.error(`[startup] Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const fastify = Fastify({ logger: true });
const PORT = parseInt(process.env.PORT || '3001', 10);

// Decorate fastify with Redis instance for rate limiter and concurrent job tracking
const redis = new Redis(process.env.REDIS_URL!);
fastify.decorate('redis', redis);

async function start() {
  // Run startup cleanup of orphaned temp directories
  await cleanupOrphanedDirs();

  // Register CORS — restrict to frontend origin in production
  await fastify.register(cors, {
    origin: process.env.FRONTEND_ORIGIN || true,
    methods: ['GET', 'POST'],
  });

  // Register plugins
  await fastify.register(rateLimiterPlugin);
  await fastify.register(securityHeadersPlugin);

  // Register routes
  await fastify.register(infoRoutes);
  await fastify.register(downloadRoutes);
  await fastify.register(progressRoutes);
  await fastify.register(fileRoutes);
  await fastify.register(healthRoutes);

  // Start server
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});

export default fastify;
