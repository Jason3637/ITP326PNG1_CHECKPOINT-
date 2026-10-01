import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Backend accepts documents up to 10 MiB (POST /api/users/documents).
      // Server Actions default to a 1MB request body cap, which the
      // multipart FormData for a document upload would blow past well
      // before the file itself hits the backend's own limit. +1MB over the
      // file cap for multipart boundary/field overhead, per Next's own docs.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
