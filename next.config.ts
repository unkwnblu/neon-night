import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Turbopack's on-disk cache was restoring an out-of-date stylesheet after a
    // restart and then ignoring further CSS edits. The project is small enough
    // that compiling from scratch each time costs almost nothing.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  // Lets phones on the same Wi-Fi load the dev server at the Mac's network
  // address. Development only; it has no effect on a deployed build.
  allowedDevOrigins: ["192.168.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
