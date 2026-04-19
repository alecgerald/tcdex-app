import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/lms',
        destination: '/lms/dashboard',
        permanent: true,
      },
      {
        source: '/lms/upload',
        destination: '/lms/upload-excel',
        permanent: true,
      },
      {
        source: '/lms/audit-logs',
        destination: '/lms/history',
        permanent: true,
      },
      {
        source: '/comms/audit-logs',
        destination: '/comms/history',
        permanent: true,
      },
      {
        source: '/comms/import-excel',
        destination: '/comms/upload-excel',
        permanent: true,
      }
    ];
  },
};

export default nextConfig;
