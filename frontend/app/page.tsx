'use client';

import { useState, useRef, useCallback } from 'react';
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

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<FormatOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Tapping a format pill triggers download directly
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
    } finally {
      setDownloading(false);
    }
  }, [url, detectedPlatform, mediaInfo, downloadOptions, downloading]);

  const platforms = Array.from(PLATFORM_REGISTRY.values());

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Video Downloader
        </h1>
        <p className="text-gray-300 text-sm">
          Paste a video URL from any supported platform.
        </p>
      </div>

      {/* URL Input */}
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
        <div className="mt-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !downloading && (
        <div className="mt-6 flex justify-center">
          <div className="animate-pulse text-cyan-400">Fetching video info...</div>
        </div>
      )}

      {jobId && (
        <div className="mt-4">
          <ProgressBar
            jobId={jobId}
            apiBase={API_BASE}
            platformColor={detectedPlatform ? PLATFORM_COLORS[detectedPlatform] : undefined}
          />
        </div>
      )}

      {mediaInfo && (
        <div className="mt-6 space-y-4">
          <MediaPreview mediaInfo={mediaInfo} />

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

          <FormatSelector
            formats={mediaInfo.formats}
            selected={selectedFormat}
            onSelect={handleFormatSelect}
            disabled={downloading}
            platformColor={detectedPlatform ? PLATFORM_COLORS[detectedPlatform] : undefined}
          />

          {HAS_TURNSTILE && <TurnstileWidget ref={turnstileRef} />}
        </div>
      )}

      {/* Supported Platforms */}
      <div className="mt-10 pt-6 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-400" />
          <h2 className="text-lg font-semibold text-gray-200">Supported Platforms</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {platforms.map((p) => {
            const color = PLATFORM_COLORS[p.id] || '#3b82f6';
            return (
              <a
                key={p.id}
                href={`/${p.id}`}
                className="group flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.02]"
                style={{
                  borderColor: `${color}30`,
                  backgroundColor: `${color}08`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${color}60`;
                  e.currentTarget.style.backgroundColor = `${color}15`;
                  e.currentTarget.style.boxShadow = `0 0 20px ${color}15`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${color}30`;
                  e.currentTarget.style.backgroundColor = `${color}08`;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                  {p.displayName}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      {/* SEO Content — How it works */}
      <div className="mt-10 pt-6 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-400" />
          <h2 className="text-lg font-semibold text-gray-200">How to Download Videos</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-xl border border-gray-800 bg-[#0f172a]">
            <div className="text-2xl mb-2">1</div>
            <h3 className="font-semibold text-gray-200 mb-1">Paste the URL</h3>
            <p className="text-gray-400">Copy the video link from any supported platform and paste it above.</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-800 bg-[#0f172a]">
            <div className="text-2xl mb-2">2</div>
            <h3 className="font-semibold text-gray-200 mb-1">Choose quality</h3>
            <p className="text-gray-400">Pick your preferred format — HD, 4K, or audio only.</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-800 bg-[#0f172a]">
            <div className="text-2xl mb-2">3</div>
            <h3 className="font-semibold text-gray-200 mb-1">Download</h3>
            <p className="text-gray-400">Tap the format and your video downloads instantly. No signup needed.</p>
          </div>
        </div>
      </div>

      {/* SEO Content — FAQ */}
      <div className="mt-10 pt-6 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-cyan-400" />
          <h2 className="text-lg font-semibold text-gray-200">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-4 text-sm">
          <details className="group p-3 rounded-xl border border-gray-800 bg-[#0f172a]">
            <summary className="font-semibold text-gray-200 cursor-pointer">Is this video downloader free?</summary>
            <p className="mt-2 text-gray-400">Yes, completely free. No signup, no hidden fees, no limits on downloads.</p>
          </details>
          <details className="group p-3 rounded-xl border border-gray-800 bg-[#0f172a]">
            <summary className="font-semibold text-gray-200 cursor-pointer">What platforms are supported?</summary>
            <p className="mt-2 text-gray-400">YouTube, Instagram, TikTok, Twitter/X, Facebook, Reddit, Vimeo, Twitch, Pinterest, LinkedIn, and Dailymotion.</p>
          </details>
          <details className="group p-3 rounded-xl border border-gray-800 bg-[#0f172a]">
            <summary className="font-semibold text-gray-200 cursor-pointer">Can I download videos on my phone?</summary>
            <p className="mt-2 text-gray-400">Yes, this tool works on any device with a browser — iPhone, Android, tablet, or desktop.</p>
          </details>
          <details className="group p-3 rounded-xl border border-gray-800 bg-[#0f172a]">
            <summary className="font-semibold text-gray-200 cursor-pointer">What quality can I download in?</summary>
            <p className="mt-2 text-gray-400">Up to 4K for YouTube, and the highest available quality for other platforms. Audio-only downloads are also supported.</p>
          </details>
          <details className="group p-3 rounded-xl border border-gray-800 bg-[#0f172a]">
            <summary className="font-semibold text-gray-200 cursor-pointer">Do I need to install anything?</summary>
            <p className="mt-2 text-gray-400">No. This is a web-based tool. Just paste a URL and download — no apps, extensions, or software needed.</p>
          </details>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <a
          href="https://evarein.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Part of EvareinSuite
        </a>
      </div>
    </main>
  );
}
