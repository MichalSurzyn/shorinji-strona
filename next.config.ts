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
        //
        // ZOSTAJE TUTAJ, świadomie. Ten adres NIGDY nie dotrze do trasy
        // catch-all: `app/organizacja/[slug]/page.tsx` dopasuje go pierwszy
        // i zrobi notFound(). Przeniesienie reguły do tabeli `redirects`
        // zamieniłoby działające 308 w twarde 404 na adresie, który Google
        // ma w indeksie.
        source: '/organizacja/zalozyciel-i-wsko',
        destination: '/organizacja/zalozyciel',
        permanent: true,
      },
      // Reguła /cennik -> /zajecia/cennik PRZENIESIONA do tabeli `redirects`
      // (status 307, source='manual') w etapie 4. Powód: reguły z tego pliku są
      // kompilowane przy buildzie, więc każda zmiana adresu wymaga redeploya,
      // którego instruktor nie zrobi. Ten jeden adres da się przenieść, bo
      // /cennik nie ma pliku trasy i trafia do catch-alla.
    ];
  },
};

export default nextConfig;
