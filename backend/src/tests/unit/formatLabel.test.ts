import { describe, it, expect } from 'vitest';
import { buildFormatLabel, parseFormatLabel } from '../../lib/formatLabel.js';

describe('buildFormatLabel', () => {
  it('builds a video label with quality and container', () => {
    expect(buildFormatLabel('1080p', 'mp4', false)).toBe('1080p MP4');
  });

  it('uppercases the container', () => {
    expect(buildFormatLabel('720p', 'webm', false)).toBe('720p WEBM');
    expect(buildFormatLabel('480p', 'MP4', false)).toBe('480p MP4');
  });

  it('builds an audio-only label', () => {
    expect(buildFormatLabel('audio', 'mp3', true)).toBe('Audio only MP3');
  });

  it('audio-only label ignores the qualityLabel argument', () => {
    expect(buildFormatLabel('1080p', 'mp3', true)).toBe('Audio only MP3');
    expect(buildFormatLabel('', 'aac', true)).toBe('Audio only AAC');
  });

  it('handles quality labels with spaces (e.g. "2160p HDR")', () => {
    expect(buildFormatLabel('2160p HDR', 'mp4', false)).toBe('2160p HDR MP4');
  });
});

describe('parseFormatLabel', () => {
  it('parses a standard video label', () => {
    expect(parseFormatLabel('1080p MP4')).toEqual({ qualityLabel: '1080p', container: 'mp4' });
  });

  it('lowercases the container', () => {
    expect(parseFormatLabel('720p WEBM')).toEqual({ qualityLabel: '720p', container: 'webm' });
  });

  it('parses an audio-only label', () => {
    expect(parseFormatLabel('Audio only MP3')).toEqual({ qualityLabel: 'audio', container: 'mp3' });
  });

  it('parses audio-only with different containers', () => {
    expect(parseFormatLabel('Audio only AAC')).toEqual({ qualityLabel: 'audio', container: 'aac' });
    expect(parseFormatLabel('Audio only OPUS')).toEqual({ qualityLabel: 'audio', container: 'opus' });
  });

  it('handles a label with no space (edge case)', () => {
    expect(parseFormatLabel('nospace')).toEqual({ qualityLabel: 'nospace', container: '' });
  });

  it('splits on the LAST space for quality labels containing spaces', () => {
    expect(parseFormatLabel('2160p HDR MP4')).toEqual({ qualityLabel: '2160p HDR', container: 'mp4' });
  });
});

describe('buildFormatLabel / parseFormatLabel round-trip', () => {
  it('round-trips a video format', () => {
    const label = buildFormatLabel('1080p', 'mp4', false);
    const parsed = parseFormatLabel(label);
    expect(parsed.qualityLabel).toBe('1080p');
    expect(parsed.container).toBe('mp4');
  });

  it('round-trips a 720p WebM format', () => {
    const label = buildFormatLabel('720p', 'webm', false);
    const parsed = parseFormatLabel(label);
    expect(parsed.qualityLabel).toBe('720p');
    expect(parsed.container).toBe('webm');
  });

  it('round-trips an audio-only format', () => {
    const label = buildFormatLabel('audio', 'mp3', true);
    const parsed = parseFormatLabel(label);
    expect(parsed.qualityLabel).toBe('audio');
    expect(parsed.container).toBe('mp3');
  });

  it('round-trips a quality label with spaces', () => {
    const label = buildFormatLabel('2160p HDR', 'mp4', false);
    const parsed = parseFormatLabel(label);
    expect(parsed.qualityLabel).toBe('2160p HDR');
    expect(parsed.container).toBe('mp4');
  });

  it('built label always contains the qualityLabel substring (video)', () => {
    const label = buildFormatLabel('1080p', 'mp4', false);
    expect(label).toContain('1080p');
    expect(label).toContain('MP4');
  });

  it('built label always contains the container substring (audio)', () => {
    const label = buildFormatLabel('audio', 'mp3', true);
    expect(label).toContain('MP3');
  });
});
