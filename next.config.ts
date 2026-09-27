import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Our images are already exported "for web" by the design team.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Marketing swaps banners without renaming files; don't let browsers keep old ones.
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/vendor/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default nextConfig
