'use client';

import { useState } from 'react';
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
  const [imgError, setImgError] = useState(false);

  const thumbnailSrc = mediaInfo.thumbnailUrl
    ? `/api/thumbnail?url=${encodeURIComponent(mediaInfo.thumbnailUrl)}`
    : '';

  return (
    <div className="flex gap-3 p-3 rounded-xl border border-gray-800 bg-[#111827]">
      {/* Thumbnail — fixed small size */}
      <div className="relative w-28 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-900">
        {thumbnailSrc && !imgError ? (
          <img
            src={thumbnailSrc}
            alt={mediaInfo.title}
            className="w-full h-full object-cover"
            loading="eager"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {mediaInfo.durationSeconds > 0 && (
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
            {formatDuration(mediaInfo.durationSeconds)}
          </span>
        )}
      </div>
      {/* Info */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <h3 className="font-semibold text-sm leading-snug text-gray-100 line-clamp-2">
          {mediaInfo.title}
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          {mediaInfo.uploaderName}
          <span className="mx-1.5 text-gray-600">·</span>
          {mediaInfo.formats.length} format{mediaInfo.formats.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
