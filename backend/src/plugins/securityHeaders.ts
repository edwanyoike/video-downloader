import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

async function securityHeadersPlugin(fastify: FastifyInstance) {
  fastify.addHook('onSend', async (_req: FastifyRequest, reply: FastifyReply, payload) => {
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self'",
    );
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return payload;
  });
}

export default fp(securityHeadersPlugin, { name: 'security-headers' });
