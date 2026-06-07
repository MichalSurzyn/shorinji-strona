import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pozwól na requesty z LAN w trybie dev (Next 15+/16+).
  // Dodaj kolejne adresy/maski, gdy zmieni się sieć.
  allowedDevOrigins: ['192.168.18.64', '192.168.0.0/16', '10.0.0.0/8'],
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
    ];
  },
};

export default nextConfig;
