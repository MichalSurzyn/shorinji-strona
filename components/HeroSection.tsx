import { CldImage } from 'next-cloudinary';

export default function HeroSection() {
  return (
    <>
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-10">
        Witamy w krakowskim dōjō Shorinji Kempo
      </h1>

      <div className="space-y-6 text-neutral-300 text-lg leading-relaxed">
        <p>
          Shorinji Kempo to japońska sztuka walki łącząca skuteczną samoobronę z głębokim rozwojem osobistym.
        </p>

        <p>
          Zgodnie z filozofią <span className="text-yellow-500 transition-colors hover:text-yellow-400 cursor-default">Ken Zen Ichinyo</span>, nie da się osiągnąć prawdziwego mistrzostwa bez opanowania zarówno własnego ciała, jak i umysłu. Kształtujemy charakter poprzez zbalansowany rozwój ciała i umysłu.
        </p>

        <p>
          Nasze dōjō to przestrzeń dla każdego – posiadamy <span className="text-yellow-500">Filię Wawel</span> dla dzieci oraz <span className="text-yellow-500">Filię Kraków</span> dla dorosłych. Posiadamy bogatą tradycję, organizujemy <span className="text-yellow-500">wyjazdy</span>, bierzemy udział w międzynarodowych <span className="text-yellow-500">seminariach</span> i tworzymy zgraną społeczność.
        </p>
      </div>

      <div className="mt-12 aspect-video bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-700 shadow-2xl relative">
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
          Tu wrzucimy zdjęcie z &lt;CldImage /&gt;
        </div>
      </div>
    </>
  );
}