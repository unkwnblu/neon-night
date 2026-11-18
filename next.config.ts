import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Puts the small stylesheet straight into the page, saving a round trip
    // before anything can be drawn.
    inlineCss: true,
    // Turbopack's on-disk cache was restoring an out-of-date stylesheet after a
    // restart and then ignoring further CSS edits. The project is small enough
    // that compiling from scratch each time costs almost nothing.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  // Lets phones on the same Wi-Fi load the dev server at the Mac's network
  // address. Development only; it has no effect on a deployed build.
  // ngrok: lets the dev server work when opened through a tunnel (testing Bachs payments locally).
  allowedDevOrigins: ["192.168.*.*", "*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app"],
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
