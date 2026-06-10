import type { Metadata } from 'next';
import VerticalKanji from '../components/VerticalKanji';
import HeroSection from '../components/HeroSection';
import NewsSidebar from '../components/NewsSidebar';

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Home() {


  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      


      {/* Główny kontener 80% */}
      <div className="w-[80%] mx-auto z-10 relative">
        
        {/* Podział 60% / 20% (względem całego ekranu, czyli 3/4 do 1/4 wewnątrz kontenera 80%) */}
        <div className="flex flex-col lg:flex-row gap-12">
          
          <div className="lg:w-3/4">
            <HeroSection />
          </div>

          <div className="lg:w-1/4">
            <NewsSidebar />
          </div>

        </div>
      </div>
    </div>
  );
}