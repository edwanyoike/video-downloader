'use client';

import type { FormatOption } from '@/lib/types';

interface FormatSelectorProps {
  formats: FormatOption[];
  selected: FormatOption | null;
  onSelect: (format: FormatOption) => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FormatSelector({ formats, selected, onSelect }: FormatSelectorProps) {
  const videoFormats = formats.filter((f) => !f.isAudioOnly);
  const audioFormats = formats.filter((f) => f.isAudioOnly);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Format & Quality</label>

      {videoFormats.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Video</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {videoFormats.map((f) => (
              <button
                key={f.formatId}
                onClick={() => onSelect(f)}
                className={`p-2 text-sm rounded-lg border transition-colors text-left ${
                  selected?.formatId === f.formatId
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{f.label}</div>
                {f.fileSizeBytes && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    ~{formatFileSize(f.fileSizeBytes)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {audioFormats.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Audio Only</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {audioFormats.map((f) => (
              <button
                key={f.formatId}
                onClick={() => onSelect(f)}
                className={`p-2 text-sm rounded-lg border transition-colors text-left ${
                  selected?.formatId === f.formatId
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{f.label}</div>
                {f.fileSizeBytes && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    ~{formatFileSize(f.fileSizeBytes)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected?.fileSizeBytes && (
        <p className="text-xs text-gray-500">
          Estimated size: {formatFileSize(selected.fileSizeBytes)}
        </p>
      )}
    </div>
  );
}
