import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project directory. Otherwise Turbopack
  // walks up until it finds a lockfile — and a stray package-lock.json in
  // C:\Users\nbumacod\ gets picked as the root, breaking module resolution
  // and asset paths. See:
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
