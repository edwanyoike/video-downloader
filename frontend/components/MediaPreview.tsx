'use client';

import type { MediaInfo } from '@/lib/types';

interface MediaPreviewProps {
  mediaInfo: MediaInfo;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MediaPreview({ mediaInfo }: MediaPreviewProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] overflow-hidden">
      {/* Thumbnail — full width on mobile */}
      {mediaInfo.thumbnailUrl && (
        <div className="relative w-full aspect-video bg-black">
          <img
            src={mediaInfo.thumbnailUrl}
            alt={mediaInfo.title}
            className="w-full h-full object-cover"
            loading="eager"
          />
          {mediaInfo.durationSeconds > 0 && (
            <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-2 py-0.5 rounded">
              {formatDuration(mediaInfo.durationSeconds)}
            </span>
          )}
        </div>
      )}
      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-sm leading-snug text-gray-100 line-clamp-2">
          {mediaInfo.title}
        </h3>
        <p className="text-xs text-gray-400 mt-1.5">
          {mediaInfo.uploaderName}
          <span className="mx-1.5 text-gray-600">·</span>
          {mediaInfo.formats.length} format{mediaInfo.formats.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
