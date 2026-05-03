'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { validateUrl } from '@/lib/urlValidator';
import { PLATFORM_REGISTRY } from '@/lib/platformRegistry';

interface UrlInputProps {
  platformId?: string;
  onValidUrl: (normalizedUrl: string, platformId: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

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

  return (
    <div>
      <div className="relative">
        <input
          type="url"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Paste video URL here..."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          autoFocus
        />
        {platformName && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
            {platformName}
          </span>
        )}
      </div>
      {validationError && (
        <p className="mt-1 text-sm text-red-500">{validationError}</p>
      )}
      {!validationError && value.trim() && detectedPlatform && (
        <button
          onClick={onSubmit}
          className="mt-3 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Get Video Info
        </button>
      )}
    </div>
  );
}
