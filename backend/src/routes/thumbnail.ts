import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface ThumbnailQuery {
  url: string;
}

export default async function thumbnailRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ThumbnailQuery }>(
    '/api/thumbnail',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: ThumbnailQuery }>, reply: FastifyReply) => {
      const { url } = req.query;

      // Only allow proxying from known CDN domains
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return reply.status(400).send({ error: 'Invalid URL' });
      }

      const allowedHosts = [
        'i.ytimg.com',
        'i9.ytimg.com',
        'scontent.cdninstagram.com',
        'instagram.com',
        'p16-sign.tiktokcdn.com',
        'p16-sign-sg.tiktokcdn.com',
        'pbs.twimg.com',
        'external-preview.redd.it',
        'preview.redd.it',
        'i.vimeocdn.com',
        'static-cdn.jtvnw.net',
        'clips-media-assets2.twitch.tv',
        'i.pinimg.com',
        'media.licdn.com',
        's1.dmcdn.net',
        's2.dmcdn.net',
        'scontent.xx.fbcdn.net',
      ];

      const isAllowed = allowedHosts.some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
      ) || parsed.hostname.match(/^scontent[-\w]*\.cdninstagram\.com$/);

      if (!isAllowed) {
        return reply.status(403).send({ error: 'Host not allowed' });
      }

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VideoDownloader/1.0)',
          },
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          return reply.status(response.status).send({ error: 'Upstream error' });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        reply.header('Content-Type', contentType);
        reply.header('Cache-Control', 'public, max-age=3600');

        const buffer = await response.arrayBuffer();
        return reply.send(Buffer.from(buffer));
      } catch {
        return reply.status(502).send({ error: 'Failed to fetch thumbnail' });
      }
    },
  );
}
