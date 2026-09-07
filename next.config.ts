import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" output is required for Docker/AWS deployments (bundles the
  // Node.js server into .next/standalone). Vercel manages its own output
  // format and MUST NOT use "standalone" — doing so breaks the build with:
  //   ENOENT: no such file or directory, open '.next/next-server.js.nft.json'
  // Set STANDALONE_BUILD=true in Docker/Amplify build environments only.
  ...(process.env.STANDALONE_BUILD === "true" ? { output: "standalone" } : {}),

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;