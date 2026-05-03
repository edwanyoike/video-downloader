import { spawn } from 'node:child_process';
import type { MediaInfo, FormatOption, SubtitleTrack } from '../types';
import { classifyYtdlpError } from '../lib/ytdlpErrorMapper';
import { buildFormatLabel } from '../lib/formatLabel';
import { detectPlatform } from '../platforms/registry';

const TIMEOUT_MS = 20_000;

/**
 * Simple BCP-47 language code → display name lookup.
 * Falls back to the language code itself if not found.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  af: 'Afrikaans',
  ar: 'Arabic',
  az: 'Azerbaijani',
  be: 'Belarusian',
  bg: 'Bulgarian',
  bn: 'Bengali',
  bs: 'Bosnian',
  ca: 'Catalan',
  cs: 'Czech',
  cy: 'Welsh',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  eo: 'Esperanto',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fa: 'Persian',
  fi: 'Finnish',
  fr: 'French',
  ga: 'Irish',
  gl: 'Galician',
  gu: 'Gujarati',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  hy: 'Armenian',
  id: 'Indonesian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  ka: 'Georgian',
  kk: 'Kazakh',
  km: 'Khmer',
  kn: 'Kannada',
  ko: 'Korean',
  lt: 'Lithuanian',
  lv: 'Latvian',
  mk: 'Macedonian',
  ml: 'Malayalam',
  mn: 'Mongolian',
  mr: 'Marathi',
  ms: 'Malay',
  mt: 'Maltese',
  my: 'Burmese',
  nb: 'Norwegian Bokmål',
  ne: 'Nepali',
  nl: 'Dutch',
  pa: 'Punjabi',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  si: 'Sinhala',
  sk: 'Slovak',
  sl: 'Slovenian',
  sq: 'Albanian',
  sr: 'Serbian',
  sv: 'Swedish',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tl: 'Filipino',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  zh: 'Chinese',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  zu: 'Zulu',
};

function getLanguageName(code: string): string {
  // Try exact match first, then try the base language code (e.g. "en-US" → "en")
  return LANGUAGE_NAMES[code] ?? LANGUAGE_NAMES[code.split('-')[0]] ?? code;
}

/**
 * Maps a yt-dlp JSON format object to a FormatOption.
 * Returns null for formats that should be skipped (e.g. storyboards).
 */
function mapFormat(
  format: Record<string, unknown>,
  isDefault: boolean,
): FormatOption | null {
  if (format['format_note'] === 'storyboard') {
    return null;
  }

  const formatId = String(format['format_id'] ?? '');
  const container = String(format['ext'] ?? 'mp4');
  const isAudioOnly = format['vcodec'] === 'none';

  let qualityLabel: string;
  if (isAudioOnly) {
    const abr = format['abr'];
    qualityLabel = typeof abr === 'number' ? `${Math.round(abr)}kbps` : 'audio';
  } else {
    const height = format['height'];
    if (typeof height === 'number') {
      qualityLabel = `${height}p`;
    } else {
      const formatNote = format['format_note'];
      qualityLabel = typeof formatNote === 'string' && formatNote
        ? formatNote
        : formatId;
    }
  }

  const filesize = format['filesize'];
  const filesizeApprox = format['filesize_approx'];
  const fileSizeBytes: number | undefined =
    typeof filesize === 'number' ? filesize :
    typeof filesizeApprox === 'number' ? filesizeApprox :
    undefined;

  const label = buildFormatLabel(qualityLabel, container, isAudioOnly);

  return {
    formatId,
    container,
    isAudioOnly,
    qualityLabel,
    fileSizeBytes,
    label,
    isDefault,
  };
}

/**
 * Maps the yt-dlp subtitles object to SubtitleTrack[].
 * Skips the "live_chat" key and filters to only srt/vtt formats.
 */
function mapSubtitles(
  subtitlesObj: Record<string, unknown>,
): SubtitleTrack[] {
  const tracks: SubtitleTrack[] = [];

  for (const [lang, entries] of Object.entries(subtitlesObj)) {
    if (lang === 'live_chat') continue;
    if (!Array.isArray(entries)) continue;

    const formats: ('srt' | 'vtt')[] = [];
    for (const entry of entries) {
      if (entry && typeof entry === 'object' && 'ext' in entry) {
        const ext = (entry as Record<string, unknown>)['ext'];
        if (ext === 'srt' || ext === 'vtt') {
          formats.push(ext);
        }
      }
    }

    if (formats.length > 0) {
      tracks.push({
        language: lang,
        languageName: getLanguageName(lang),
        formats,
      });
    }
  }

  return tracks;
}

/**
 * Parses a yt-dlp --dump-json output into a MediaInfo object.
 *
 * @param ytdlpJson  - Parsed JSON from yt-dlp stdout
 * @param platformId - Platform ID detected from the URL
 */
export function parseMediaInfo(
  ytdlpJson: Record<string, unknown>,
  platformId: string,
): MediaInfo {
  const rawFormats = ytdlpJson['formats'];
  const formatsArray: Record<string, unknown>[] = Array.isArray(rawFormats)
    ? (rawFormats as Record<string, unknown>[])
    : [];

  // Determine which format should be marked as default:
  // highest video resolution, or best audio if no video formats exist.
  let bestVideoHeight = -1;
  let bestVideoIndex = -1;
  let bestAudioAbr = -1;
  let bestAudioIndex = -1;

  for (let i = 0; i < formatsArray.length; i++) {
    const fmt = formatsArray[i];
    if (fmt['format_note'] === 'storyboard') continue;

    const isAudioOnly = fmt['vcodec'] === 'none';
    if (!isAudioOnly) {
      const height = fmt['height'];
      if (typeof height === 'number' && height > bestVideoHeight) {
        bestVideoHeight = height;
        bestVideoIndex = i;
      }
    } else {
      const abr = fmt['abr'];
      if (typeof abr === 'number' && abr > bestAudioAbr) {
        bestAudioAbr = abr;
        bestAudioIndex = i;
      }
    }
  }

  const defaultIndex = bestVideoIndex !== -1 ? bestVideoIndex : bestAudioIndex;

  const formats: FormatOption[] = [];
  for (let i = 0; i < formatsArray.length; i++) {
    const mapped = mapFormat(formatsArray[i], i === defaultIndex);
    if (mapped !== null) {
      formats.push(mapped);
    }
  }

  // Map subtitles if present
  let subtitles: SubtitleTrack[] | undefined;
  const rawSubtitles = ytdlpJson['subtitles'];
  if (rawSubtitles && typeof rawSubtitles === 'object' && !Array.isArray(rawSubtitles)) {
    const mapped = mapSubtitles(rawSubtitles as Record<string, unknown>);
    if (mapped.length > 0) {
      subtitles = mapped;
    }
  }

  const uploader = ytdlpJson['uploader'];
  const channel = ytdlpJson['channel'];
  const uploaderId = ytdlpJson['uploader_id'];
  const uploaderName =
    (typeof uploader === 'string' && uploader) ||
    (typeof channel === 'string' && channel) ||
    (typeof uploaderId === 'string' && uploaderId) ||
    'Unknown';

  return {
    id: String(ytdlpJson['id'] ?? ''),
    title: String(ytdlpJson['title'] ?? ''),
    thumbnailUrl: String(ytdlpJson['thumbnail'] ?? ''),
    durationSeconds: typeof ytdlpJson['duration'] === 'number' ? ytdlpJson['duration'] : 0,
    uploaderName,
    platformId,
    formats,
    ...(subtitles !== undefined ? { subtitles } : {}),
  };
}

/**
 * Fetches video metadata by invoking yt-dlp with --dump-json.
 *
 * @param url - The validated, normalised video URL
 * @returns   Parsed MediaInfo
 * @throws    AppError (from classifyYtdlpError) on failure or timeout
 */
export async function fetchMetadata(url: string): Promise<MediaInfo> {
  const ytdlpPath = process.env['YTDLP_PATH'] ?? 'yt-dlp';

  const args = [
    '--dump-json',
    '--no-playlist',
    '--socket-timeout', '15',
    url,
  ];

  return new Promise<MediaInfo>((resolve, reject) => {
    const child = spawn(ytdlpPath, args, { shell: false });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(classifyYtdlpError('', -1));
    }, TIMEOUT_MS);

    child.on('close', (exitCode: number | null) => {
      clearTimeout(timer);

      const code = exitCode ?? 1;

      if (code !== 0) {
        reject(classifyYtdlpError(stderr, code));
        return;
      }

      let json: Record<string, unknown>;
      try {
        json = JSON.parse(stdout.trim()) as Record<string, unknown>;
      } catch {
        reject(classifyYtdlpError('Failed to parse yt-dlp JSON output', 1));
        return;
      }

      // Detect platform from the URL hostname
      let platformId = 'unknown';
      try {
        const hostname = new URL(url).hostname;
        const platform = detectPlatform(hostname);
        if (platform) {
          platformId = platform.id;
        }
      } catch {
        // hostname detection is best-effort; fall back to 'unknown'
      }

      try {
        const mediaInfo = parseMediaInfo(json, platformId);
        resolve(mediaInfo);
      } catch (err) {
        reject(classifyYtdlpError('Failed to parse media info', 1));
      }
    });

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(classifyYtdlpError(err.message, 1));
    });
  });
}
