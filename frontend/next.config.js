/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['localhost'],
  },

  eslint: {
    ignoreDuringBuilds: true, // 👈 THIS is what you need
  },
}

module.exports = nextConfig