import type { NextConfig } from "next";
import identity from "./lib/build-identity.json";

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: identity.deploymentId,
  generateBuildId: async () => identity.artifactId,
  experimental: { isrFlushToDisk: false },
  images: {
    unoptimized: true,
  },
  async headers() {
    // Last matching values win. Keep default → sandboxed images → board
    // exceptions in this order: reordering loses the sandbox or blocks drawers.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/api/images/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; sandbox; frame-ancestors 'none'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Disposition", value: "inline" },
        ],
      },
      ...["/", "/:postId([0-9a-fA-F-]{36})"].map((source) => ({
        source,
        has: [{ type: "query" as const, key: "embed", value: "drawer" }],
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      })),
    ];
  },
};

export default nextConfig;
