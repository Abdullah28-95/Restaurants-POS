import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prevent Next.js from treating a stray D:\\package-lock.json as this
  // project's workspace root on Windows.
  outputFileTracingRoot: path.resolve(process.cwd()),
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }, { protocol: 'http', hostname: '**' }] },
};

export default nextConfig;
