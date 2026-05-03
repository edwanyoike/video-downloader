import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../../lib/sanitizeFilename.js';

describe('sanitizeFilename', () => {
  it('handles a normal title', () => {
    expect(sanitizeFilename('My Awesome Video', 'mp4')).toBe('My Awesome Video.mp4');
  });

  it('strips characters illegal on NTFS/HFS+/ext4', () => {
    expect(sanitizeFilename('My Video: Part 1/2', 'mp4')).toBe('My Video Part 12.mp4');
    expect(sanitizeFilename('file\\name*with?illegal"chars<here>|now', 'mp4')).toBe(
      'filenamewithillegalcharsherenow.mp4'
    );
  });

  it('strips all illegal characters: / \\ : * ? " < > |', () => {
    const illegal = '/\\:*?"<>|';
    const result = sanitizeFilename(`a${illegal}b`, 'mp4');
    expect(result).toBe('ab.mp4');
  });

  it('falls back to "download" for an empty title', () => {
    expect(sanitizeFilename('', 'mp4')).toBe('download.mp4');
  });

  it('falls back to "download" for a title that becomes empty after sanitization', () => {
    // Only illegal characters
    expect(sanitizeFilename('/\\:*?"<>|', 'mp4')).toBe('download.mp4');
    // Only control characters
    expect(sanitizeFilename('\x00\x01\x1F\x7F', 'mp4')).toBe('download.mp4');
    // Only dots and spaces
    expect(sanitizeFilename('... ...', 'mp4')).toBe('download.mp4');
  });

  it('strips leading and trailing dots and spaces', () => {
    expect(sanitizeFilename('...hello...', 'mp3')).toBe('hello.mp3');
    expect(sanitizeFilename('  hello  ', 'mp4')).toBe('hello.mp4');
    expect(sanitizeFilename('...  hello  ...', 'mp4')).toBe('hello.mp4');
  });

  it('collapses consecutive whitespace into a single space', () => {
    expect(sanitizeFilename('hello   world', 'mp4')).toBe('hello world.mp4');
    // \t and \n are ASCII control characters (0x09, 0x0A) — stripped in step 1
    expect(sanitizeFilename('hello\t\nworld', 'mp4')).toBe('helloworld.mp4');
    // Regular spaces are collapsed
    expect(sanitizeFilename('a  b  c', 'mp4')).toBe('a b c.mp4');
  });

  it('collapses consecutive dots into a single dot', () => {
    expect(sanitizeFilename('hello...world', 'mp4')).toBe('hello.world.mp4');
    expect(sanitizeFilename('v1....0', 'mp4')).toBe('v1.0.mp4');
  });

  it('truncates titles longer than 200 characters', () => {
    const longTitle = 'a'.repeat(250);
    const result = sanitizeFilename(longTitle, 'mp4');
    // Base name should be exactly 200 chars, plus ".mp4"
    expect(result).toBe('a'.repeat(200) + '.mp4');
    expect(result.length).toBe(204);
  });

  it('truncates at exactly 200 characters before appending extension', () => {
    const title200 = 'x'.repeat(200);
    expect(sanitizeFilename(title200, 'mp4')).toBe('x'.repeat(200) + '.mp4');

    const title201 = 'x'.repeat(201);
    expect(sanitizeFilename(title201, 'mp4')).toBe('x'.repeat(200) + '.mp4');
  });

  it('lowercases the format extension', () => {
    expect(sanitizeFilename('video', 'MP4')).toBe('video.mp4');
    expect(sanitizeFilename('audio', 'MP3')).toBe('audio.mp3');
    expect(sanitizeFilename('clip', 'WebM')).toBe('clip.webm');
  });

  it('strips null bytes and ASCII control characters', () => {
    const withControls = 'hello\x00world\x1Ftest\x7F';
    expect(sanitizeFilename(withControls, 'mp4')).toBe('helloworldtest.mp4');
  });

  it('handles the documented example: My Video: Part 1/2', () => {
    expect(sanitizeFilename('My Video: Part 1/2', 'mp4')).toBe('My Video Part 12.mp4');
  });

  it('handles the documented example: ...hello...', () => {
    expect(sanitizeFilename('...hello...', 'mp3')).toBe('hello.mp3');
  });

  it('preserves Unicode and emoji characters', () => {
    expect(sanitizeFilename('Vidéo 🎬 título', 'mp4')).toBe('Vidéo 🎬 título.mp4');
  });

  it('handles a title that is only dots after stripping illegal chars', () => {
    expect(sanitizeFilename('...', 'mp4')).toBe('download.mp4');
  });
});
