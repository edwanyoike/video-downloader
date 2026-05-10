/**
 * Sanitizes a video title into a safe filename for NTFS, HFS+, and ext4 filesystems.
 *
 * Rules applied in order:
 * 1. Strip null bytes and ASCII control characters (0x00–0x1F, 0x7F)
 * 2. Strip characters illegal on NTFS/HFS+/ext4: / \ : * ? " < > |
 * 3. Strip hashtags (#word) — common in TikTok/Instagram titles
 * 4. Collapse consecutive whitespace into a single space
 * 5. Collapse consecutive dots into a single dot
 * 6. Trim leading and trailing whitespace and dots
 * 7. Truncate to 200 characters (before appending extension)
 * 8. Fall back to "download" if the result is empty
 * 9. Append the format extension: .${format.toLowerCase()}
 */
export function sanitizeFilename(title: string, format: string): string {
  // Step 1: Strip null bytes and ASCII control characters (0x00–0x1F, 0x7F)
  let name = title.replace(/[\x00-\x1F\x7F]/g, '');

  // Step 2: Strip characters illegal on NTFS/HFS+/ext4
  name = name.replace(/[/\\:*?"<>|]/g, '');

  // Step 3: Strip hashtags
  name = name.replace(/#\S+/g, '');

  // Step 4: Collapse consecutive whitespace into a single space
  name = name.replace(/\s+/g, ' ');

  // Step 5: Collapse consecutive dots into a single dot
  name = name.replace(/\.{2,}/g, '.');

  // Step 6: Trim leading and trailing whitespace and dots
  name = name.replace(/^[\s.]+|[\s.]+$/g, '');

  // Step 7: Truncate to 200 characters
  name = name.slice(0, 200);

  // Step 8: Fall back to "download" if empty
  if (name.length === 0) {
    name = 'download';
  }

  // Step 9: Append format extension
  return `${name}.${format.toLowerCase()}`;
}
