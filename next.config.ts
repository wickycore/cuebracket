import type { NextConfig } from "next";

const mediaPatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
try {
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (storageUrl) {
    const parsed = new URL(storageUrl);
    mediaPatterns.push({ protocol: "https", hostname: parsed.hostname, pathname: "/storage/v1/object/public/**" });
  }
} catch {
  // A malformed optional build variable should not stop local development.
}

const nextConfig: NextConfig = {
  images: { remotePatterns: mediaPatterns },
  async headers() {
    return [{ source: "/sw.js", headers: [
      { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ] }];
  },
};

export default nextConfig;
