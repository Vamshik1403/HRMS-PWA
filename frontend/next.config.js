/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },

  eslint: {
    ignoreDuringBuilds: true, // 👈 THIS is what you need
  },

  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: 'http://localhost:8001/:path*',
      },
    ]
  },
}

module.exports = nextConfig