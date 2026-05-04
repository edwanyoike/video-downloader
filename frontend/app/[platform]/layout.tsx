import type { Metadata } from 'next';
import { PLATFORM_REGISTRY } from '@/lib/platformRegistry';

const SITE_URL = 'https://dl.evarein.com';

const PLATFORM_SEO: Record<string, { title: string; description: string; keywords: string[] }> = {
  youtube: {
    title: 'YouTube Video Downloader — Download YouTube Videos in HD, 4K, MP4',
    description:
      'Download YouTube videos, Shorts, and playlists in HD, 1080p, 4K quality. Save as MP4 or extract audio. Free, no signup, works on mobile.',
    keywords: ['youtube downloader', 'download youtube video', 'youtube to mp4', 'youtube hd download', 'youtube shorts downloader', 'save youtube video', 'youtube 4k downloader'],
  },
  instagram: {
    title: 'Instagram Video Downloader — Download Reels, Stories, Posts',
    description:
      'Download Instagram Reels, Stories, and video posts in HD quality. Save Instagram videos to your device. Free, no login required.',
    keywords: ['instagram downloader', 'download instagram reels', 'instagram video downloader', 'save instagram video', 'instagram story downloader', 'download reels'],
  },
  tiktok: {
    title: 'TikTok Video Downloader — Download TikTok Without Watermark',
    description:
      'Download TikTok videos without watermark in HD quality. Save TikTok videos to your phone or computer. Free, no app needed.',
    keywords: ['tiktok downloader', 'download tiktok video', 'tiktok without watermark', 'save tiktok video', 'tiktok to mp4', 'tiktok video saver'],
  },
  twitter: {
    title: 'Twitter/X Video Downloader — Download X Videos and GIFs',
    description:
      'Download videos and GIFs from Twitter/X in HD quality. Save tweets with video to your device. Supports both twitter.com and x.com URLs.',
    keywords: ['twitter video downloader', 'x video downloader', 'download twitter video', 'save twitter video', 'twitter gif downloader', 'x.com downloader'],
  },
  facebook: {
    title: 'Facebook Video Downloader — Download FB Videos in HD',
    description:
      'Download Facebook videos in HD quality. Save videos from Facebook posts, Reels, and Watch. Free, no login required.',
    keywords: ['facebook video downloader', 'download facebook video', 'fb video downloader', 'save facebook video', 'facebook reels downloader'],
  },
  reddit: {
    title: 'Reddit Video Downloader — Download Reddit Videos with Audio',
    description:
      'Download Reddit videos with audio merged. Save videos from any subreddit in HD quality. Free, works with v.redd.it links.',
    keywords: ['reddit video downloader', 'download reddit video', 'reddit video with audio', 'save reddit video', 'v.redd.it downloader'],
  },
  vimeo: {
    title: 'Vimeo Video Downloader — Download Vimeo Videos in HD',
    description:
      'Download Vimeo videos in HD, 1080p, 4K quality. Save Vimeo videos as MP4. Free, no account needed.',
    keywords: ['vimeo downloader', 'download vimeo video', 'vimeo to mp4', 'save vimeo video'],
  },
  twitch: {
    title: 'Twitch Clip Downloader — Download Twitch Clips and VODs',
    description:
      'Download Twitch clips and VODs in HD quality. Save your favorite Twitch moments. Free, no login required.',
    keywords: ['twitch clip downloader', 'download twitch clip', 'twitch vod downloader', 'save twitch clip'],
  },
  pinterest: {
    title: 'Pinterest Video Downloader — Download Pinterest Videos and Pins',
    description:
      'Download videos and images from Pinterest pins. Save Pinterest content in HD quality. Free, no signup.',
    keywords: ['pinterest downloader', 'download pinterest video', 'pinterest video saver', 'save pinterest pin'],
  },
  linkedin: {
    title: 'LinkedIn Video Downloader — Download LinkedIn Videos',
    description:
      'Download videos from LinkedIn posts and feeds. Save LinkedIn video content in HD quality. Free, no login required.',
    keywords: ['linkedin video downloader', 'download linkedin video', 'save linkedin video'],
  },
  dailymotion: {
    title: 'Dailymotion Video Downloader — Download Dailymotion Videos in HD',
    description:
      'Download Dailymotion videos in HD quality. Save as MP4. Free, no signup, works on all devices.',
    keywords: ['dailymotion downloader', 'download dailymotion video', 'dailymotion to mp4'],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>;
}): Promise<Metadata> {
  const { platform } = await params;
  const config = PLATFORM_REGISTRY.get(platform);
  const seo = PLATFORM_SEO[platform];

  if (!config || !seo) {
    return { title: 'Not Found' };
  }

  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `${SITE_URL}/${platform}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    },
    alternates: {
      canonical: `${SITE_URL}/${platform}`,
    },
  };
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
