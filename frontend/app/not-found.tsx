import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-24 text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-gray-500 mb-6">This page doesn't exist.</p>
      <Link
        href="/"
        className="text-blue-600 hover:underline"
      >
        ← Back to Video Downloader
      </Link>
    </main>
  );
}
