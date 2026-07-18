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
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
