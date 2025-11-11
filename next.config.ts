import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  // PWA configuration
  experimental: {
    // Enable app directory support for PWA
  },
  // Silence Turbopack warning for PWA plugin
  turbopack: {},
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Custom service worker
  sw: "/sw.js",
  // Build ID for cache busting
  buildExcludes: [/manifest\.json$/],
})(nextConfig);
