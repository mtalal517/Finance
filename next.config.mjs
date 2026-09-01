/** @type {import('next').NextConfig} */
const nextConfig = {
  // Every page reads from the database per request; nothing is prerendered.
  // That is enforced per-page with `export const dynamic = 'force-dynamic'`.

  // The MongoDB driver loads optional native dependencies at runtime, which the
  // bundler cannot follow. Leaving it external keeps it working on Vercel.
  serverExternalPackages: ['mongodb'],
};

export default nextConfig;
