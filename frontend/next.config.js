/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.ytimg.com' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.tiktokcdn.com' },
      { protocol: 'https', hostname: '**.twimg.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.redd.it' },
      { protocol: 'https', hostname: '**.vimeocdn.com' },
      { protocol: 'https', hostname: '**.jtvnw.net' },
      { protocol: 'https', hostname: '**.pinimg.com' },
      { protocol: 'https', hostname: '**.licdn.com' },
      { protocol: 'https', hostname: '**.dmcdn.net' },
    ],
  },
};

module.exports = nextConfig;
