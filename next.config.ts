import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
