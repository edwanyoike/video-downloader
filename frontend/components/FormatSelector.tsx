'use client';

import type { FormatOption } from '@/lib/types';

interface FormatSelectorProps {
  formats: FormatOption[];
  selected: FormatOption | null;
  onSelect: (format: FormatOption) => void;
  disabled?: boolean;
  platformColor?: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `~${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `~${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Extract numeric resolution from qualityLabel like "1080p" → 1080 */
function getResolution(f: FormatOption): number {
  const match = f.qualityLabel.match(/(\d+)p/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Extract numeric bitrate from qualityLabel like "128kbps" → 128 */
function getBitrate(f: FormatOption): number {
  const match = f.qualityLabel.match(/(\d+)kbps/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Sort: highest quality first, then by file size descending */
function sortFormats(formats: FormatOption[]): FormatOption[] {
  return [...formats].sort((a, b) => {
    const resA = getResolution(a);
    const resB = getResolution(b);
    if (resA !== resB) return resB - resA;

    const brA = getBitrate(a);
    const brB = getBitrate(b);
    if (brA !== brB) return brB - brA;

    return (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0);
  });
}

function FormatCard({
  format,
  isSelected,
  onSelect,
  accent,
  disabled,
}: {
  format: FormatOption;
  isSelected: boolean;
  onSelect: () => void;
  accent: string;
  disabled?: boolean;
}) {
  const res = getResolution(format);
  const isHD = res >= 720;
  const is4K = res >= 2160;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className="w-full p-3 rounded-xl border text-left transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        borderColor: isSelected ? accent : '#1e293b',
        backgroundColor: isSelected ? `${accent}10` : '#0f172a',
        boxShadow: isSelected ? `0 0 12px ${accent}20` : 'none',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-100">
              {format.qualityLabel}
            </span>
            <span className="text-xs text-gray-500 uppercase">
              {format.container}
            </span>
            {is4K && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                4K
              </span>
            )}
            {isHD && !is4K && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                HD
              </span>
            )}
          </div>
          {format.fileSizeBytes && (
            <div className="text-xs text-gray-500 mt-0.5">
              {formatFileSize(format.fileSizeBytes)}
            </div>
          )}
        </div>
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{
            backgroundColor: `${accent}20`,
          }}
        >
          <svg
            className="w-4 h-4"
            style={{ color: accent }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
      </div>
    </button>
  );
}

export function FormatSelector({ formats, selected, onSelect, disabled, platformColor }: FormatSelectorProps) {
  const videoFormats = sortFormats(formats.filter((f) => !f.isAudioOnly));
  const audioFormats = sortFormats(formats.filter((f) => f.isAudioOnly));

  const accent = platformColor || '#10b981';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-200 uppercase tracking-wider font-semibold">
          Tap a format to download
        </p>
        {disabled && (
          <span className="text-xs animate-pulse" style={{ color: accent }}>
            Starting download...
          </span>
        )}
      </div>

      {videoFormats.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-semibold text-gray-200">Video</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {videoFormats.map((f) => (
              <FormatCard
                key={f.formatId}
                format={f}
                isSelected={selected?.formatId === f.formatId}
                onSelect={() => onSelect(f)}
                accent={accent}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {audioFormats.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="text-xs font-semibold text-gray-200">Audio Only</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {audioFormats.map((f) => (
              <FormatCard
                key={f.formatId}
                format={f}
                isSelected={selected?.formatId === f.formatId}
                onSelect={() => onSelect(f)}
                accent={accent}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
