export type ErrorCode =
  | 'MALFORMED'
  | 'UNSUPPORTED_PLATFORM'
  | 'PLATFORM_MISMATCH'
  | 'SSRF_BLOCKED'
  | 'CONTENT_PRIVATE'
  | 'CONTENT_UNAVAILABLE'
  | 'AGE_RESTRICTED'
  | 'GEO_RESTRICTED'
  | 'UNSUPPORTED_URL'
  | 'EXTRACTOR_TIMEOUT'
  | 'DOWNLOAD_FAILED';

export interface AppError {
  code: ErrorCode;
  message: string;
  httpStatus: number;
  userMessage: string;
}

export interface FormatOption {
  formatId: string;
  label: string;
  container: string;
  qualityLabel: string;
  fileSizeBytes?: number;
  isAudioOnly: boolean;
  isDefault: boolean;
}

export interface SubtitleTrack {
  language: string;
  languageName: string;
  formats: ('srt' | 'vtt')[];
}

export interface MediaInfo {
  id: string;
  title: string;
  thumbnailUrl: string;
  durationSeconds: number;
  uploaderName: string;
  platformId: string;
  formats: FormatOption[];
  subtitles?: SubtitleTrack[];
}

export interface DownloadJobData {
  url: string;
  platformId: string;
  formatId: string;
  title: string;
  clientIp: string;
  options: {
    subtitleLang?: string;
    subtitleFormat?: 'srt' | 'vtt';
    noWatermark?: boolean;
  };
  createdAt: number;
}

export interface JobProgressData {
  stage: 'queued' | 'downloading' | 'merging' | 'complete' | 'error';
  percent: number;
  eta?: number;
  speed?: string;
  message?: string;
  fileReady?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  platformId?: string;
  error?: 'MALFORMED' | 'UNSUPPORTED_PLATFORM' | 'PLATFORM_MISMATCH' | 'SSRF_BLOCKED';
  errorMessage?: string;
}

export interface PlatformOption {
  id: string;
  label: string;
  type: 'toggle' | 'select';
  values?: string[];
  default: unknown;
}

/**
 * Frontend-safe platform config — omits ytdlpArgs (backend-only) and DownloadOptions.
 */
export interface PlatformConfig {
  id: string;
  displayName: string;
  domains: string[];
  urlPatterns: RegExp[];
  trackingParams: string[];
  options: PlatformOption[];
}
