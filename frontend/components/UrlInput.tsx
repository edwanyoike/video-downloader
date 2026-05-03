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

  const platformName = detectedPlatform
    ? PLATFORM_REGISTRY.get(detectedPlatform)?.displayName
    : null;

  const platformColor = detectedPlatform
    ? PLATFORM_COLORS[detectedPlatform] || '#3b82f6'
    : undefined;

  return (
    <div>
      <div
        className="relative rounded-xl border transition-all"
        style={{
          borderColor: platformColor ? `${platformColor}50` : '#1e293b',
          boxShadow: platformColor ? `0 0 20px ${platformColor}15` : 'none',
        }}
      >
        <input
          type="url"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Paste video URL here..."
          className="w-full px-4 py-4 rounded-xl bg-[#111827] text-gray-100 placeholder-gray-500 focus:outline-none text-base"
          autoFocus
        />
        {platformName && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              backgroundColor: `${platformColor}20`,
              color: platformColor,
              border: `1px solid ${platformColor}40`,
            }}
          >
            {platformName}
          </span>
        )}
      </div>
      {validationError && (
        <p className="mt-2 text-sm text-red-400">{validationError}</p>
      )}
      {!validationError && value.trim() && detectedPlatform && (
        <button
          onClick={onSubmit}
          className="mt-3 w-full py-3 px-4 font-medium rounded-xl transition-all text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${platformColor}, ${platformColor}cc)`,
            boxShadow: `0 4px 20px ${platformColor}30`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 4px 30px ${platformColor}50`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 4px 20px ${platformColor}30`;
          }}
        >
          Get Video Info
        </button>
      )}
    </div>
  );
}
