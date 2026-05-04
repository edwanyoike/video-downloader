import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = 'https://dl.evarein.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Free Video Downloader — Download YouTube, Instagram, TikTok Videos | EvareinSuite',
    template: '%s | EvareinSuite Video Downloader',
  },
  description:
    'Download videos from YouTube, Instagram, TikTok, Twitter/X, Facebook, Reddit, Vimeo and more. Free, no signup, no ads. Paste a URL and download in HD quality.',
  keywords: [
    'video downloader',
    'youtube downloader',
    'instagram downloader',
    'tiktok downloader',
    'twitter video downloader',
    'facebook video downloader',
    'reddit video downloader',
    'download video online',
    'free video downloader',
    'hd video downloader',
    'mp4 downloader',
    'online video downloader',
    'save video from url',
    'download reels',
    'download shorts',
  ],
  authors: [{ name: 'EvareinSuite', url: 'https://evarein.com' }],
  creator: 'EvareinSuite',
  publisher: 'EvareinSuite',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'EvareinSuite Video Downloader',
    title: 'Free Video Downloader — YouTube, Instagram, TikTok & More',
    description:
      'Download videos from 11+ platforms in HD. Free, no signup, no ads. Paste a URL and download.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Video Downloader — YouTube, Instagram, TikTok & More',
    description:
      'Download videos from 11+ platforms in HD. Free, no signup, no ads.',
    creator: '@evarein',
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: 'technology',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasTurnstile = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'EvareinSuite Video Downloader',
    url: 'https://dl.evarein.com',
    description:
      'Download videos from YouTube, Instagram, TikTok, Twitter/X, Facebook, Reddit, Vimeo and more. Free, no signup required.',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'EvareinSuite',
      url: 'https://evarein.com',
    },
  };

  return (
    <html lang="en">
      <head>
        {hasTurnstile && (
          <script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            async
            defer
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
