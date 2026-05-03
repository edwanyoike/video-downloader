'use client';

import { useState, useRef, use, useCallback } from 'react';
import { notFound } from 'next/navigation';
import { PLATFORM_REGISTRY } from '@/lib/platformRegistry';
import { UrlInput } from '@/components/UrlInput';
import { MediaPreview } from '@/components/MediaPreview';
import { FormatSelector } from '@/components/FormatSelector';
import { ProgressBar } from '@/components/ProgressBar';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { YouTubeSubtitleSelector } from '@/components/YouTubeSubtitleSelector';
import { TikTokWatermarkToggle } from '@/components/TikTokWatermarkToggle';
import type { MediaInfo, FormatOption } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const HAS_TURNSTILE = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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

export default function PlatformPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform: platformId } = use(params);
  const platformConfig = PLATFORM_REGISTRY.get(platformId);

  if (!platformConfig) {
    notFound();
  }

  const color = PLATFORM_COLORS[platformId] || '#3b82f6';

  const [url, setUrl] = useState('');
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<FormatOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadOptions, setDownloadOptions] = useState<Record<string, unknown>>({});
  const turnstileRef = useRef<{ getToken: () => Promise<string> }>(null);

  const handleUrlValidated = (normalizedUrl: string) => {
    setUrl(normalizedUrl);
    setMediaInfo(null);
    setSelectedFormat(null);
    setJobId(null);
    setError(null);
  };

  const handleFetchMetadata = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, platformId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Failed to fetch video info.');
        return;
      }
      const info: MediaInfo = await res.json();
      setMediaInfo(info);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormatSelect = useCallback(async (format: FormatOption) => {
    if (!url || downloading) return;
    setSelectedFormat(format);
    setError(null);
    setDownloading(true);
    try {
      let token = '';
      if (HAS_TURNSTILE && turnstileRef.current) {
        token = await turnstileRef.current.getToken();
      }
      const res = await fetch(`${API_BASE}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          formatId: format.formatId,
          platformId,
          turnstileToken: token,
          title: mediaInfo?.title || '',
          options: downloadOptions,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Failed to start download.');
        return;
      }
      const { jobId: id } = await res.json();
      setJobId(id);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [url, platformId, mediaInfo, downloadOptions, downloading]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-3" style={{ color }}>
          {platformConfig.displayName} Downloader
        </h1>
        <p className="text-gray-400">
          Paste a {platformConfig.displayName} video URL to download it.
        </p>
        <div className="mt-2 text-xs text-gray-500">
          Accepted: {platformConfig.domains.join(', ')}
        </div>
      </div>

      <UrlInput
        platformId={platformId}
        onValidUrl={handleUrlValidated}
        onSubmit={handleFetchMetadata}
        onClear={() => {
          setMediaInfo(null);
          setSelectedFormat(null);
          setJobId(null);
          setError(null);
        }}
      />

      {error && (
        <div className="mt-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !downloading && (
        <div className="mt-6 flex justify-center">
          <div className="animate-pulse" style={{ color }}>Fetching video info...</div>
        </div>
      )}

      {mediaInfo && !jobId && (
        <div className="mt-6 space-y-4">
          <MediaPreview mediaInfo={mediaInfo} />

          {platformId === 'youtube' && mediaInfo.subtitles && (
            <YouTubeSubtitleSelector
              subtitles={mediaInfo.subtitles}
              onChange={(lang, fmt) =>
                setDownloadOptions((prev) => ({ ...prev, subtitleLang: lang, subtitleFormat: fmt }))
              }
            />
          )}

          {platformId === 'tiktok' && (
            <TikTokWatermarkToggle
              onChange={(noWatermark) =>
                setDownloadOptions((prev) => ({ ...prev, noWatermark }))
              }
            />
          )}

          <FormatSelector
            formats={mediaInfo.formats}
            selected={selectedFormat}
            onSelect={handleFormatSelect}
            disabled={downloading}
          />

          {downloading && (
            <div className="flex justify-center">
              <div className="animate-pulse" style={{ color }}>Starting download...</div>
            </div>
          )}

          {HAS_TURNSTILE && <TurnstileWidget ref={turnstileRef} />}
        </div>
      )}

      {jobId && (
        <div className="mt-6">
          <ProgressBar jobId={jobId} apiBase={API_BASE} />
        </div>
      )}

      <div className="mt-8 text-center">
        <a href="/" className="text-sm text-gray-500 hover:text-emerald-400 transition-colors">
          ← All platforms
        </a>
      </div>
    </main>
  );
}
