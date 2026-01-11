/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  images: {
    domains: ['localhost'],
  },
}

module.exports = nextConfig
