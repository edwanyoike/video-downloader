'use client';

import { useState, useRef } from 'react';
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

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<FormatOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadOptions, setDownloadOptions] = useState<Record<string, unknown>>({});
  const turnstileRef = useRef<{ getToken: () => Promise<string> }>(null);

  const handleUrlValidated = (normalizedUrl: string, platformId: string) => {
    setUrl(normalizedUrl);
    setDetectedPlatform(platformId);
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
        body: JSON.stringify({ url, platformId: detectedPlatform }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Failed to fetch video info.');
        return;
      }
      const info: MediaInfo = await res.json();
      setMediaInfo(info);
      const defaultFmt = info.formats.find((f) => f.isDefault) || info.formats[0];
      setSelectedFormat(defaultFmt || null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!url || !selectedFormat || !turnstileRef.current) return;
    setError(null);
    try {
      const token = await turnstileRef.current.getToken();
      const res = await fetch(`${API_BASE}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          formatId: selectedFormat.formatId,
          platformId: detectedPlatform,
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
    }
  };

  const platforms = Array.from(PLATFORM_REGISTRY.values());

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center mb-2">Video Downloader</h1>
      <p className="text-center text-gray-500 mb-8">
        Paste a video URL from any supported platform to download it.
      </p>

      <UrlInput
        onValidUrl={handleUrlValidated}
        onSubmit={handleFetchMetadata}
        onClear={() => {
          setMediaInfo(null);
          setSelectedFormat(null);
          setJobId(null);
          setError(null);
          setDetectedPlatform(null);
        }}
      />

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-6 flex justify-center">
          <div className="animate-pulse text-gray-400">Fetching video info...</div>
        </div>
      )}

      {mediaInfo && !jobId && (
        <div className="mt-6 space-y-4">
          <MediaPreview mediaInfo={mediaInfo} />

          <FormatSelector
            formats={mediaInfo.formats}
            selected={selectedFormat}
            onSelect={setSelectedFormat}
          />

          {detectedPlatform === 'youtube' && mediaInfo.subtitles && (
            <YouTubeSubtitleSelector
              subtitles={mediaInfo.subtitles}
              onChange={(lang, fmt) =>
                setDownloadOptions((prev) => ({ ...prev, subtitleLang: lang, subtitleFormat: fmt }))
              }
            />
          )}

          {detectedPlatform === 'tiktok' && (
            <TikTokWatermarkToggle
              onChange={(noWatermark) =>
                setDownloadOptions((prev) => ({ ...prev, noWatermark }))
              }
            />
          )}

          <TurnstileWidget ref={turnstileRef} />

          <button
            onClick={handleDownload}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Download
          </button>
        </div>
      )}

      {jobId && (
        <div className="mt-6">
          <ProgressBar jobId={jobId} apiBase={API_BASE} />
        </div>
      )}

      <div className="mt-12 border-t pt-8">
        <h2 className="text-lg font-semibold mb-4 text-center">Supported Platforms</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {platforms.map((p) => (
            <a
              key={p.id}
              href={`/${p.id}`}
              className="flex items-center justify-center p-3 rounded-lg border hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              {p.displayName}
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
