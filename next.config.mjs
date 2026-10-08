/**
 * `STATIC_EXPORT=1 npm run build` produces a fully static, relocatable bundle in ./out
 * (the app is 100% client-side, so it can be hosted on any static file server).
 */
const isExport = process.env.STATIC_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  ...(isExport ? { output: 'export', assetPrefix: './', images: { unoptimized: true } } : {}),
};

export default nextConfig;
