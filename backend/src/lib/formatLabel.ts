/**
 * Builds a human-readable format label for display in the UI.
 *
 * @param qualityLabel - e.g. "1080p", "720p", "audio"
 * @param container    - e.g. "mp4", "webm", "mp3"
 * @param isAudioOnly  - when true, produces "Audio only <CONTAINER>"
 * @returns            - e.g. "1080p MP4", "Audio only MP3"
 */
export function buildFormatLabel(
  qualityLabel: string,
  container: string,
  isAudioOnly: boolean
): string {
  if (isAudioOnly) {
    return `Audio only ${container.toUpperCase()}`;
  }
  return `${qualityLabel} ${container.toUpperCase()}`;
}

/**
 * Parses a format label produced by `buildFormatLabel` back into its components.
 *
 * @param label - e.g. "1080p MP4", "Audio only MP3"
 * @returns     - `{ qualityLabel, container }` where container is lowercased
 */
export function parseFormatLabel(label: string): { qualityLabel: string; container: string } {
  const AUDIO_ONLY_PREFIX = 'Audio only ';

  if (label.startsWith(AUDIO_ONLY_PREFIX)) {
    const container = label.slice(AUDIO_ONLY_PREFIX.length);
    return { qualityLabel: 'audio', container: container.toLowerCase() };
  }

  const lastSpaceIndex = label.lastIndexOf(' ');
  if (lastSpaceIndex === -1) {
    return { qualityLabel: label, container: '' };
  }

  const qualityLabel = label.slice(0, lastSpaceIndex);
  const container = label.slice(lastSpaceIndex + 1).toLowerCase();
  return { qualityLabel, container };
}
