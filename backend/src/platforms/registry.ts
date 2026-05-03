import { PlatformConfig, PlatformOption, DownloadOptions } from '../types';

// Base yt-dlp args shared by all platforms
function baseArgs(opts: DownloadOptions): string[] {
  return [
    '--no-playlist',
    '--socket-timeout', '15',
    '-f', opts.formatId || 'bestvideo+bestaudio/best',
    '--merge-output-format', 'mp4',
    '--progress-template', '{"stage":"downloading","percent":%(progress._percent_str)s,"eta":%(progress.eta)s,"speed":"%(progress.speed_str)s"}',
  ];
}

const youtube: PlatformConfig = {
  id: 'youtube',
  displayName: 'YouTube',
  domains: ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'],
  urlPatterns: [
    /^https:\/\/(www\.|m\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https:\/\/(www\.|m\.)?youtube\.com\/shorts\/[\w-]+/,
    /^https:\/\/youtu\.be\/[\w-]+/,
  ],
  trackingParams: [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'si', 'feature', 'app', 'ref',
  ],
  options: [
    {
      id: 'quality',
      label: 'Quality',
      type: 'select',
      values: ['best', '2160p', '1440p', '1080p', '720p', '480p', '360p'],
      default: 'best',
    } as PlatformOption,
    {
      id: 'subtitleLang',
      label: 'Download subtitles',
      type: 'toggle',
      default: false,
    } as PlatformOption,
  ],
  ytdlpArgs: (opts: DownloadOptions) => {
    const args = baseArgs(opts);

    if (opts.subtitleLang) {
      args.push(
        '--write-subs',
        '--sub-lang', opts.subtitleLang,
        '--sub-format', opts.subtitleFormat || 'srt',
      );
    }

    if (process.env.YOUTUBE_COOKIES_FILE) {
      args.push('--cookies', process.env.YOUTUBE_COOKIES_FILE);
    }

    return args;
  },
};

const instagram: PlatformConfig = {
  id: 'instagram',
  displayName: 'Instagram',
  domains: ['instagram.com', 'www.instagram.com'],
  urlPatterns: [
    /^https:\/\/(www\.)?instagram\.com\/p\/[\w-]+/,
    /^https:\/\/(www\.)?instagram\.com\/reel\/[\w-]+/,
    /^https:\/\/(www\.)?instagram\.com\/stories\/[\w.]+\/\d+/,
  ],
  trackingParams: ['igshid', 'utm_source', 'utm_medium'],
  options: [],
  ytdlpArgs: (opts: DownloadOptions) => baseArgs(opts),
};

const tiktok: PlatformConfig = {
  id: 'tiktok',
  displayName: 'TikTok',
  domains: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'm.tiktok.com'],
  urlPatterns: [
    /^https:\/\/(www\.|m\.)?tiktok\.com\/@[\w.]+\/video\/\d+/,
    /^https:\/\/vm\.tiktok\.com\/[\w]+/,
  ],
  trackingParams: [
    '_r', 'checksum', 'sec_uid', 'share_app_id', 'share_link_id',
    'timestamp', 'tt_from', 'u_code',
  ],
  options: [
    {
      id: 'noWatermark',
      label: 'Remove watermark',
      type: 'toggle',
      default: false,
    } as PlatformOption,
  ],
  ytdlpArgs: (opts: DownloadOptions) => {
    const args = baseArgs(opts);

    if (opts.noWatermark) {
      args.push(
        '--extractor-args',
        'tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com',
      );
    }

    return args;
  },
};

const twitter: PlatformConfig = {
  id: 'twitter',
  displayName: 'X (Twitter)',
  domains: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com', 't.co'],
  urlPatterns: [
    /^https:\/\/(www\.)?(twitter|x)\.com\/\w+\/status\/\d+/,
  ],
  trackingParams: ['s', 't', 'ref_src', 'ref_url'],
  options: [],
  ytdlpArgs: (opts: DownloadOptions) => baseArgs(opts),
};

const facebook: PlatformConfig = {
  id: 'facebook',
  displayName: 'Facebook',
  domains: ['facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com'],
  urlPatterns: [
    /^https:\/\/(www\.|m\.)?facebook\.com\/.*\/videos\/\d+/,
    /^https:\/\/(www\.|m\.)?facebook\.com\/watch\/?\?v=\d+/,
    /^https:\/\/fb\.watch\/[\w-]+/,
  ],
  trackingParams: ['utm_source', 'utm_medium', 'utm_campaign', '__cft__', '__tn__'],
  options: [],
  ytdlpArgs: (opts: DownloadOptions) => baseArgs(opts),
};

const reddit: PlatformConfig = {
  id: 'reddit',
  displayName: 'Reddit',
  domains: ['reddit.com', 'www.reddit.com', 'v.redd.it', 'old.reddit.com'],
  urlPatterns: [
    /^https:\/\/(www\.|old\.)?reddit\.com\/r\/\w+\/comments\/[\w]+/,
    /^https:\/\/v\.redd\.it\/[\w]+/,
  ],
  trackingParams: ['utm_source', 'utm_medium', 'utm_name', 'utm_term', 'utm_content'],
  options: [],
  ytdlpArgs: (opts: DownloadOptions) => baseArgs(opts),
};

const vimeo: PlatformConfig = {
  id: 'vimeo',
  displayName: 'Vimeo',
  domains: ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'],
  urlPatterns: [
    /^https:\/\/(www\.)?vimeo\.com\/\d+/,
    /^https:\/\/player\.vimeo\.com\/video\/\d+/,
  ],
  trackingParams: ['utm_source', 'utm_medium', 'utm_campaign'],
  options: [],
  ytdlpArgs: (opts: DownloadOptions) => baseArgs(opts),
};

const twitch: PlatformConfig = {
  id: 'twitch',
  displayName: 'Twitch',
  domains: ['twitch.tv', 'www.twitch.tv', 'clips.twitch.tv', 'm.twitch.tv'],
  urlPatterns: [
    /^https:\/\/(www\.|m\.)?twitch\.tv\/videos\/\d+/,
    /^https:\/\/clips\.twitch\.tv\/[\w-]+/,
    /^https:\/\/(www\.|m\.)?twitch\.tv\/\w+\/clip\/[\w-]+/,
  ],
  trackingParams: ['tt_medium', 'tt_content'],
  options: [],
  ytdlpArgs: (opts: DownloadOptions) => baseArgs(opts),
};

const pinterest: PlatformConfig = {
  id: 'pinterest',
  displayName: 'Pinterest',
  domains: ['pinterest.com', 'www.pinterest.com', 'pin.it', 'pinterest.co.uk'],
  urlPatterns: [
    /^https:\/\/(www\.)?pinterest\.(com|co\.uk)\/pin\/\d+/,
    /^https:\/\/pin\.it\/[\w]+/,
  ],
  trackingParams: ['utm_source', 'utm_medium', 'utm_campaign', 'e_t'],
  options: [],
  ytdlpArgs: (opts: DownloadOptions) => baseArgs(opts),
};

const linkedin: PlatformConfig = {
  id: 'linkedin',
  displayName: 'LinkedIn',
  domains: ['linkedin.com', 'www.linkedin.com'],
  urlPatterns: [
    /^https:\/\/(www\.)?linkedin\.com\/posts\/[\w-]+/,
    /^https:\/\/(www\.)?linkedin\.com\/feed\/update\/[\w:]+/,
  ],
  trackingParams: ['trackingId', 'lipi', 'licu', 'rcm'],
  options: [],
  ytdlpArgs: (opts: DownloadOptions) => baseArgs(opts),
};

const dailymotion: PlatformConfig = {
  id: 'dailymotion',
  displayName: 'Dailymotion',
  domains: ['dailymotion.com', 'www.dailymotion.com', 'dai.ly'],
  urlPatterns: [
    /^https:\/\/(www\.)?dailymotion\.com\/video\/[\w]+/,
    /^https:\/\/dai\.ly\/[\w]+/,
  ],
  trackingParams: ['utm_source', 'utm_medium', 'utm_campaign'],
  options: [],
  ytdlpArgs: (opts: DownloadOptions) => baseArgs(opts),
};

// Registry of all supported platforms
export const PLATFORM_REGISTRY: Map<string, PlatformConfig> = new Map([
  ['youtube', youtube],
  ['instagram', instagram],
  ['tiktok', tiktok],
  ['twitter', twitter],
  ['facebook', facebook],
  ['reddit', reddit],
  ['vimeo', vimeo],
  ['twitch', twitch],
  ['pinterest', pinterest],
  ['linkedin', linkedin],
  ['dailymotion', dailymotion],
]);

/**
 * Detects the platform for a given hostname.
 * Strips leading "www." before matching against each platform's domains array.
 */
export function detectPlatform(hostname: string): PlatformConfig | undefined {
  const normalized = hostname.toLowerCase().replace(/^www\./, '');

  for (const platform of PLATFORM_REGISTRY.values()) {
    for (const domain of platform.domains) {
      const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
      if (normalized === normalizedDomain) {
        return platform;
      }
    }
  }

  return undefined;
}
