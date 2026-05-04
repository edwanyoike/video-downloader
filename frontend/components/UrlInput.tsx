'use client';

import { useState, useCallback, useRef } from 'react';
import { validateUrl } from '@/lib/urlValidator';
import { PLATFORM_REGISTRY } from '@/lib/platformRegistry';

interface UrlInputProps {
  platformId?: string;
  onValidUrl: (normalizedUrl: string, platformId: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#ff0000',
  instagram: '#e1306c',
  tiktok: '#00f2ea',
  twitter: '#1da1f2',
  facebook: '#1877f2',
  reddit: '#ff4500',
  vimeo: '#1ab7ea',
  twitch: '#9146ff',
  pinterest: '#e60023',
  linkedin: '#0a66c2',
  dailymotion: '#00d2f3',
};

export function UrlInput({ platformId, onValidUrl, onSubmit, onClear }: UrlInputProps) {
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validate = useCallback(
    (raw: string) => {
      if (!raw.trim()) {
        setValidationError(null);
        setDetectedPlatform(null);
        onClear();
        return;
      }

      const result = validateUrl(raw, platformId);
      if (result.valid) {
        setValidationError(null);
        setDetectedPlatform(result.platformId || null);
        onValidUrl(result.normalizedUrl!, result.platformId!);
      } else {
        setValidationError(result.errorMessage || 'Invalid URL');
        setDetectedPlatform(null);
      }
    },
    [platformId, onValidUrl, onClear],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setValue(raw);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => validate(raw), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !validationError && value.trim()) {
      onSubmit();
    }
  };

  const platformColor = detectedPlatform
    ? PLATFORM_COLORS[detectedPlatform] || '#10b981'
    : '#10b981';

  const hasValidUrl = !validationError && value.trim() && detectedPlatform;

  return (
    <div>
      <div
        className="flex items-center rounded-xl border-2 transition-all overflow-hidden"
        style={{
          borderColor: hasValidUrl ? platformColor : '#10b981',
          boxShadow: hasValidUrl ? `0 0 16px ${platformColor}25` : '0 0 16px rgba(16,185,129,0.1)',
          backgroundColor: '#0f172a',
        }}
      >
        <input
          type="url"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Paste video URL here..."
          className="flex-1 min-w-0 px-4 py-3.5 bg-transparent text-white placeholder-gray-300 focus:outline-none text-sm"
          autoFocus
        />
        <button
          onClick={onSubmit}
          disabled={!hasValidUrl}
          className="flex-shrink-0 px-4 py-3.5 text-sm font-semibold text-white transition-all disabled:opacity-30"
          style={{
            backgroundColor: hasValidUrl ? platformColor : '#10b981',
          }}
        >
          Get Video
        </button>
      </div>
      {validationError && (
        <p className="mt-2 text-xs text-red-400">{validationError}</p>
      )}
    </div>
  );
}
