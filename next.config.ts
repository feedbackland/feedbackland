import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: `${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
      },
    ],
  },
};

export default nextConfig;
