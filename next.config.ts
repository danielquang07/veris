import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The message scanner now lives inside Veris Shield
  async redirects() {
    return [{ source: "/check-scam", destination: "/shield", permanent: false }];
  },
};

export default nextConfig;
