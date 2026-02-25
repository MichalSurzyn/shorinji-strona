import VerticalKanji from '../components/VerticalKanji';

export default function Home() {
  // Nasze znaki do przekazania do komponentu
  const leftKanji = ['剣', '禅', '一', '如'];
  const rightKanji = ['力', '愛', '不', '二'];

  return (
    // Dodajemy padding top (pt-32), żeby znikający navbar nie zasłaniał tekstu
    <div className="relative pt-32 pb-20 min-h-screen">
      
      {/* Tło - przyklejone Kanji */}
      <VerticalKanji characters={leftKanji} side="left" />
      <VerticalKanji characters={rightKanji} side="right" />

      {/* Główny kontener na treść na środku */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 z-10 relative">
        
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-10">
          Witamy w krakowskim dōjō Shorinji Kempo
        </h1>

        <div className="space-y-6 text-neutral-300 text-lg leading-relaxed">
          <p>
            Shorinji Kempo to japońska sztuka walki łącząca skuteczną samoobronę z głębokim rozwojem osobistym.
          </p>

          <p>
            Zgodnie z filozofią <span className="text-red-500 transition-colors hover:text-red-400 cursor-default">Ken Zen Ichinyo</span>, nie da się osiągnąć prawdziwego mistrzostwa bez opanowania zarówno własnego ciała, jak i umysłu. Kształtujemy charakter poprzez zbalansowany rozwój ciała i umysłu.
          </p>

          <p>
            Nasze dōjō to przestrzeń dla każdego – posiadamy <span className="text-red-500">Filię Wawel</span> dla dzieci oraz <span className="text-red-500">Filię Kraków</span> dla dorosłych. Posiadamy bogatą tradycję, organizujemy <span className="text-red-500">wyjazdy</span>, bierzemy udział w międzynarodowych <span className="text-red-500">seminariach</span> i tworzymy zgraną społeczność.
          </p>
        </div>

        {/* Miejsce na zdjęcie/film z treningu */}
        <div className="mt-12 aspect-video bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-700 shadow-2xl flex items-center justify-center">
           {/* Gdy ogarniemy Cloudinary/Supabase, tu wpadnie tag <Image /> lub <video /> */}
           <span className="text-neutral-500">Miejsce na zdjęcie/wideo z dōjō</span>
        </div>

      </div>
    </div>
  );
}