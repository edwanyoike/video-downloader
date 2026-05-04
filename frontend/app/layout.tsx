import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Video Downloader',
  description: 'Download videos from YouTube, Instagram, TikTok, and more — ad-free.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasTurnstile = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
