import type { NextConfig } from 'next';

const configuredApiUrl =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

const apiOrigin = configuredApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.0.0.61'],

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
