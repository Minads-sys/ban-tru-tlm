import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        source: "/huong-dan",
        destination: "/huong-dan-hoc-sinh.pdf",
        permanent: false,
      },
      {
        source: "/hdsd",
        destination: "/huong-dan-hoc-sinh.pdf",
        permanent: false,
      },
      {
        source: "/huong-dan-hoc-sinh",
        destination: "/huong-dan-hoc-sinh.pdf",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
