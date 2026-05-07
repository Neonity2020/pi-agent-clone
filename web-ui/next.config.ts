import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    'openai',
    '@anthropic-ai/sdk',
    '@google/generative-ai',
    'neonity-agent',
  ],
};

export default nextConfig;
