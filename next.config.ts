import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nâng giới hạn body size: mặc định Next.js chỉ cho 10MB
  // Thực tế upload tối đa ~13MB (26 ảnh × 500KB đã nén), đặt 25MB là dư dả và an toàn cho VPS 2GB RAM
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },

  async headers() {
    return [
      {
        // Áp dụng security headers cho tất cả routes
        source: "/(.*)",
        headers: [
          // Chống clickjacking - không cho phép nhúng trang vào iframe của trang khác
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Chống MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Chỉ gửi referrer trong cùng origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Bật HSTS (HTTPS-only) - 1 năm, bao gồm subdomains
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Giới hạn quyền truy cập API trình duyệt
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // Chống XSS cơ bản (cho trình duyệt cũ)
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/hdsd",
        destination: "/huong-dan",
        permanent: false,
      },
      {
        source: "/huong-dan-hoc-sinh",
        destination: "/huong-dan",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

