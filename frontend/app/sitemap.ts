import type { MetadataRoute } from 'next';

const SITE_URL = 'https://dl.evarein.com';

const PLATFORMS = [
  'youtube',
  'instagram',
  'tiktok',
  'twitter',
  'facebook',
  'reddit',
  'vimeo',
  'twitch',
  'pinterest',
  'linkedin',
  'dailymotion',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const platformPages = PLATFORMS.map((platform) => ({
    url: `${SITE_URL}/${platform}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...platformPages,
  ];
}
