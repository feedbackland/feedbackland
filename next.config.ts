import type { NextConfig } from "next";
import identity from "./lib/build-identity.json";

const nextConfig: NextConfig = {
  output: "standalone",
  deploymentId: identity.deploymentId,
  generateBuildId: async () => identity.artifactId,
  experimental: { isrFlushToDisk: false },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: `${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
      },
    ],
  },
};

export default nextConfig;
