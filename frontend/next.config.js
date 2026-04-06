/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },

  eslint: {
    ignoreDuringBuilds: true, // 👈 THIS is what you need
  },
}

module.exports = nextConfig