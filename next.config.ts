import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pozwól na requesty z LAN w trybie dev (Next 15+/16+).
  // UWAGA: matcher Next porównuje segmenty hosta (jak w remotePatterns) -
  // maski CIDR (192.168.0.0/16) NIE działają, `*` = dokładnie jeden segment.
  // Celowo tylko typowe sieci domowe (bez 172.*.*.* - łapałby publiczne hosty).
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
  turbopack: {
    root: appRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        // Stary adres podstrony o założycielu (przed rozdzieleniem treści).
        source: '/organizacja/zalozyciel-i-wsko',
        destination: '/organizacja/zalozyciel',
        permanent: true,
      },
      {
        // Cennik przeniesiony pod Zajęcia (2026-07). 302 na start -
        // po okresie przejściowym można zmienić na permanent.
        source: '/cennik',
        destination: '/zajecia/cennik',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
