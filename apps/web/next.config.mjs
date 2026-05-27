/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.wishly.app',
      },
      ...(process.env.NODE_ENV === 'development'
        ? [{ protocol: 'https', hostname: '**' }]
        : []),
    ],
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

export default nextConfig
