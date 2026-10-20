import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: { useTypeScriptCli: false },
  async headers() {
    return [
      {
        source: "/conta",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
  async rewrites() {
    const apiOrigin =
      process.env.PRUMO_API_INTERNAL_ORIGIN ?? "http://127.0.0.1:3001";

    return [
      { source: "/api", destination: `${apiOrigin}/api` },
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
    ];
  },
};

export default nextConfig;
