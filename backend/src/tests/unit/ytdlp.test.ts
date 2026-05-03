import { describe, it, expect } from 'vitest';
import { parseMediaInfo } from '../../extractors/ytdlp';

// Minimal yt-dlp JSON fixture for a video with both video and audio formats
const baseVideoFormat = {
  format_id: '137',
  ext: 'mp4',
  vcodec: 'avc1.640028',
  acodec: 'none',
  height: 1080,
  filesize: 50_000_000,
};

const audioFormat = {
  format_id: '140',
  ext: 'm4a',
  vcodec: 'none',
  acodec: 'mp4a.40.2',
  abr: 128,
  filesize: 5_000_000,
};

const storyboardFormat = {
  format_id: 'sb0',
  ext: 'mhtml',
  vcodec: 'none',
  acodec: 'none',
  format_note: 'storyboard',
};

const baseJson: Record<string, unknown> = {
  id: 'dQw4w9WgXcQ',
  title: 'Rick Astley - Never Gonna Give You Up',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  duration: 212,
  uploader: 'Rick Astley',
  formats: [audioFormat, baseVideoFormat, storyboardFormat],
};

describe('parseMediaInfo', () => {
  it('maps top-level fields correctly', () => {
    const info = parseMediaInfo(baseJson, 'youtube');
    expect(info.id).toBe('dQw4w9WgXcQ');
    expect(info.title).toBe('Rick Astley - Never Gonna Give You Up');
    expect(info.thumbnailUrl).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    expect(info.durationSeconds).toBe(212);
    expect(info.uploaderName).toBe('Rick Astley');
    expect(info.platformId).toBe('youtube');
  });

  it('skips storyboard formats', () => {
    const info = parseMediaInfo(baseJson, 'youtube');
    const ids = info.formats.map((f) => f.formatId);
    expect(ids).not.toContain('sb0');
    expect(ids).toContain('137');
    expect(ids).toContain('140');
  });

  it('marks the highest-resolution video format as default', () => {
    const json = {
      ...baseJson,
      formats: [
        { ...audioFormat },
        { ...baseVideoFormat, format_id: '136', height: 720 },
        { ...baseVideoFormat, format_id: '137', height: 1080 },
      ],
    };
    const info = parseMediaInfo(json, 'youtube');
    const defaultFmt = info.formats.find((f) => f.isDefault);
    expect(defaultFmt?.formatId).toBe('137');
    expect(defaultFmt?.qualityLabel).toBe('1080p');
  });

  it('marks best audio as default when no video formats exist', () => {
    const json = {
      ...baseJson,
      formats: [
        { ...audioFormat, format_id: '140', abr: 128 },
        { ...audioFormat, format_id: '251', abr: 160 },
      ],
    };
    const info = parseMediaInfo(json, 'youtube');
    const defaultFmt = info.formats.find((f) => f.isDefault);
    expect(defaultFmt?.formatId).toBe('251');
    expect(defaultFmt?.isAudioOnly).toBe(true);
  });

  it('builds correct qualityLabel for audio-only formats', () => {
    const json = { ...baseJson, formats: [{ ...audioFormat, abr: 128 }] };
    const info = parseMediaInfo(json, 'youtube');
    expect(info.formats[0].qualityLabel).toBe('128kbps');
    expect(info.formats[0].isAudioOnly).toBe(true);
  });

  it('uses "audio" as qualityLabel when abr is absent', () => {
    const json = {
      ...baseJson,
      formats: [{ ...audioFormat, abr: undefined }],
    };
    const info = parseMediaInfo(json, 'youtube');
    expect(info.formats[0].qualityLabel).toBe('audio');
  });

  it('builds correct qualityLabel for video formats using height', () => {
    const json = { ...baseJson, formats: [{ ...baseVideoFormat, height: 720 }] };
    const info = parseMediaInfo(json, 'youtube');
    expect(info.formats[0].qualityLabel).toBe('720p');
    expect(info.formats[0].isAudioOnly).toBe(false);
  });

  it('falls back to format_note then format_id for qualityLabel when height is absent', () => {
    const noHeight = { ...baseVideoFormat, height: undefined, format_note: 'HD' };
    const json = { ...baseJson, formats: [noHeight] };
    const info = parseMediaInfo(json, 'youtube');
    expect(info.formats[0].qualityLabel).toBe('HD');

    const noHeightNoNote = { ...baseVideoFormat, height: undefined, format_note: undefined, format_id: 'xyz' };
    const json2 = { ...baseJson, formats: [noHeightNoNote] };
    const info2 = parseMediaInfo(json2, 'youtube');
    expect(info2.formats[0].qualityLabel).toBe('xyz');
  });

  it('maps fileSizeBytes from filesize, then filesize_approx, then undefined', () => {
    const withFilesize = { ...baseVideoFormat, filesize: 1000, filesize_approx: 900 };
    const withApprox = { ...baseVideoFormat, filesize: undefined, filesize_approx: 900 };
    const withNeither = { ...baseVideoFormat, filesize: undefined, filesize_approx: undefined };

    const i1 = parseMediaInfo({ ...baseJson, formats: [withFilesize] }, 'youtube');
    expect(i1.formats[0].fileSizeBytes).toBe(1000);

    const i2 = parseMediaInfo({ ...baseJson, formats: [withApprox] }, 'youtube');
    expect(i2.formats[0].fileSizeBytes).toBe(900);

    const i3 = parseMediaInfo({ ...baseJson, formats: [withNeither] }, 'youtube');
    expect(i3.formats[0].fileSizeBytes).toBeUndefined();
  });

  it('maps subtitles correctly, skipping live_chat and non-srt/vtt formats', () => {
    const json = {
      ...baseJson,
      subtitles: {
        en: [{ ext: 'vtt' }, { ext: 'srt' }, { ext: 'json3' }],
        fr: [{ ext: 'vtt' }],
        live_chat: [{ ext: 'json' }],
      },
    };
    const info = parseMediaInfo(json, 'youtube');
    expect(info.subtitles).toBeDefined();
    const langs = info.subtitles!.map((s) => s.language);
    expect(langs).toContain('en');
    expect(langs).toContain('fr');
    expect(langs).not.toContain('live_chat');

    const en = info.subtitles!.find((s) => s.language === 'en')!;
    expect(en.formats).toEqual(['vtt', 'srt']);
    expect(en.languageName).toBe('English');

    const fr = info.subtitles!.find((s) => s.language === 'fr')!;
    expect(fr.languageName).toBe('French');
  });

  it('omits subtitles field when no valid subtitle tracks exist', () => {
    const info = parseMediaInfo(baseJson, 'youtube');
    expect(info.subtitles).toBeUndefined();
  });

  it('falls back to channel, then uploader_id, then "Unknown" for uploaderName', () => {
    const noUploader = { ...baseJson, uploader: undefined, channel: 'Rick Channel', uploader_id: 'rickid' };
    expect(parseMediaInfo(noUploader, 'youtube').uploaderName).toBe('Rick Channel');

    const noChannel = { ...baseJson, uploader: undefined, channel: undefined, uploader_id: 'rickid' };
    expect(parseMediaInfo(noChannel, 'youtube').uploaderName).toBe('rickid');

    const noAny = { ...baseJson, uploader: undefined, channel: undefined, uploader_id: undefined };
    expect(parseMediaInfo(noAny, 'youtube').uploaderName).toBe('Unknown');
  });

  it('handles missing formats array gracefully', () => {
    const json = { ...baseJson, formats: undefined };
    const info = parseMediaInfo(json, 'youtube');
    expect(info.formats).toEqual([]);
  });

  it('produces a label via buildFormatLabel', () => {
    const json = { ...baseJson, formats: [{ ...baseVideoFormat, height: 1080, ext: 'mp4' }] };
    const info = parseMediaInfo(json, 'youtube');
    expect(info.formats[0].label).toBe('1080p MP4');
  });
});
