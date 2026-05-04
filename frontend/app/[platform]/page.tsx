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
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-1" style={{ color }}>
          {platformConfig.displayName} Downloader
        </h1>
        <p className="text-gray-300 text-sm">
          Paste a {platformConfig.displayName} video URL to download it.
        </p>
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

      {jobId && (
        <div className="mt-4">
          <ProgressBar
            jobId={jobId}
            apiBase={API_BASE}
            platformColor={PLATFORM_COLORS[platformId]}
          />
        </div>
      )}

      {mediaInfo && (
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
            platformColor={PLATFORM_COLORS[platformId]}
          />

          {HAS_TURNSTILE && <TurnstileWidget ref={turnstileRef} />}
        </div>
      )}

      {/* Other tools */}
      <div className="mt-10 pt-6 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-400" />
          <h2 className="text-lg font-semibold text-gray-200">Other Downloaders</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from(PLATFORM_REGISTRY.values())
            .filter((p) => p.id !== platformId)
            .map((p) => {
              const c = PLATFORM_COLORS[p.id] || '#3b82f6';
              return (
                <a
                  key={p.id}
                  href={`/${p.id}`}
                  className="flex items-center gap-2 p-2.5 rounded-xl border text-sm transition-all hover:scale-[1.02]"
                  style={{ borderColor: `${c}30`, backgroundColor: `${c}08` }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                  <span className="text-gray-300 font-medium">{p.displayName}</span>
                </a>
              );
            })}
        </div>
      </div>

      <div className="mt-8 text-center">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
          </svg>
          Back to all tools
        </a>
      </div>
    </main>
  );
}
