import type { NextConfig } from "next";

/**
 * ERP rasmlari qaysi domen(lar)dan kelishi env orqali beriladi:
 *   ERP_IMAGE_HOSTS=cdn.erp.example.uz,files.erp.example.uz
 * Shu ro'yxatdagi domenlardan kelgan rasmlar Next.js tomonidan
 * optimallashtiriladi (webp/avif, o'lcham bo'yicha).
 */
function erpImagePatterns() {
  return (process.env.ERP_IMAGE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean)
    .map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" }));
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 80, 90],
    remotePatterns: erpImagePatterns(),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
