import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "bullmq",
    "ioredis",
    "@prisma/client",
    "pg",
  ],
  experimental: {
    // Allow logo/favicon/product uploads up to ~10MB (multipart overhead included)
    serverActions: {
      bodySizeLimit: "10mb",
    },
    proxyClientMaxBodySize: "10mb",
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
