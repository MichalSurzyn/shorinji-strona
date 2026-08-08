import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Footer from "../components/Footer";
import Navbar from "@/components/Navbar";
import VerticalKanji from "@/components/VerticalKanji";
import StructuredData from "../components/StructuredData";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "../lib/site";
import { getNavTree } from "../lib/navigation";
import { getSchedule } from "../lib/schedule";

const inter = Inter({ subsets: ["latin"] });

const DEFAULT_TITLE = "Shorinji Kempo Kraków: japońska sztuka walki";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | Shorinji Kempo Kraków",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Shorinji Kempo",
    "Shorinji Kempo Kraków",
    "sztuki walki Kraków",
    "samoobrona Kraków",
    "dōjō Kraków",
    "zajęcia dla dzieci Kraków",
    "Kongo Zen",
  ],
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Shorinji Kempo Kraków",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};
  const leftKanji = ['拳', '禅', '一', '如'];
  const rightKanji = ['力', '愛', '不', '二'];
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Menu i harmonogram z bazy danych (edytowalne w panelu), z fallbackiem
  // do kodu. Oba odczyty równolegle - nie zależą od siebie.
  const [navLinks, scheduleSlots] = await Promise.all([getNavTree(), getSchedule()]);

  return (
    <html lang="pl">
      <body className={`${inter.className} bg-neutral-900 text-white min-h-screen flex flex-col`}>
        <StructuredData slots={scheduleSlots} />
        <Navbar links={navLinks} />
        {/* Zawartość główna strony (flex-grow wypycha stopkę na dół) */}
        <main className="flex-grow">
        <VerticalKanji characters={leftKanji} side="left" />
        <VerticalKanji characters={rightKanji} side="right" />
          {children}
        </main>

        {/* Twoja nowa stopka */}
        <Footer />
      </body>
    </html>
  );
}
