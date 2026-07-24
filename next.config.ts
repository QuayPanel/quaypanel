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
  // Runtime zip-drop addons live on disk outside the JS bundle.
  outputFileTracingIncludes: {
    "/addons/**": ["./plugins/**/*", "./themes/**/*"],
    "/api/v1/addons": ["./plugins/**/*", "./themes/**/*"],
  },
  experimental: {
    // Allow logo/favicon/product uploads up to ~10MB (multipart overhead included)
    serverActions: {
      bodySizeLimit: "10mb",
    },
    proxyClientMaxBodySize: "10mb",
  },
  turbopack: {
    // Intentional runtime FS under /plugins and /themes. Turbopack still flags
    // next.config.ts when any traced route touches cwd-based path joins.
    ignoreIssue: [
      {
        path: "**/next.config.*",
        title: /Encountered unexpected file in NFT list/,
      },
      {
        path: "**/src/addons/**",
        title: /Encountered unexpected file in NFT list/,
      },
      {
        path: "**/app/addons/**",
        title: /Encountered unexpected file in NFT list/,
      },
    ],
  },
};

export default nextConfig;
