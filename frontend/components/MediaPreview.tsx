'use client';

import type { MediaInfo } from '@/lib/types';

interface MediaPreviewProps {
  mediaInfo: MediaInfo;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MediaPreview({ mediaInfo }: MediaPreviewProps) {
  return (
    <div className="flex gap-4 p-4 border rounded-lg bg-gray-50">
      {mediaInfo.thumbnailUrl && (
        <img
          src={mediaInfo.thumbnailUrl}
          alt={mediaInfo.title}
          className="w-40 h-24 object-cover rounded flex-shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{mediaInfo.title}</h3>
        <p className="text-xs text-gray-500 mt-1">{mediaInfo.uploaderName}</p>
        <p className="text-xs text-gray-400 mt-1">
          {formatDuration(mediaInfo.durationSeconds)} · {mediaInfo.formats.length} format
          {mediaInfo.formats.length !== 1 ? 's' : ''} available
        </p>
      </div>
    </div>
  );
}
