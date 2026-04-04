/** @type {import('next').NextConfig} */
const nextConfig = {
  // IMAP + MIME parsers use Node streams; keep them external for the App Router server bundle.
  // Next.js 14 expects this under `experimental`.
  experimental: {
    serverComponentsExternalPackages: ['imapflow', 'mailparser'],
  },
};

export default nextConfig;
