import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "solid-space-train-wrxqpwqqg5v9hv6jj-3000.app.github.dev",
      ],
    },
  },
};

export default nextConfig;