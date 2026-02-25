import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// Importujemy Twój nowy komponent
import Footer from "../components/Footer"; 
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shorinji Kempo Kraków",
  description: "Japońska sztuka walki w Krakowie",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className={`${inter.className} bg-neutral-900 text-white min-h-screen flex flex-col`}>
        {/* Tutaj w przyszłości wstawisz <Navbar /> */}
        <Navbar />
        {/* Zawartość główna strony (flex-grow wypycha stopkę na dół) */}
        <main className="flex-grow">
          {children}
        </main>

        {/* Twoja nowa stopka */}
        <Footer />
      </body>
    </html>
  );
}