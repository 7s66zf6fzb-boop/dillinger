/** @type {import('next').NextConfig} */
const nextConfig = {
  // The desktop app builds into its own folder so it never clashes with `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Optimize barrel file imports for better tree-shaking
    // This transforms imports from lucide-react to direct icon imports
    optimizePackageImports: ["lucide-react"],
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  },
};

export default nextConfig;
