import Link from "next/link";

export default function HeroSection() {
  const linkClass =
    "text-yellow-500 hover:text-yellow-400 underline-offset-4 hover:underline transition-colors";

  return (
    <>
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-10">
        Witamy w krakowskim dōjō Shorinji Kempo
      </h1>

      <div className="space-y-6 text-neutral-300 text-lg leading-relaxed">
        <p>
          <Link href="/o-shorinji/wprowadzenie" className={linkClass}>Shorinji Kempo</Link>{" "}
          to japońska sztuka walki, w której skuteczna samoobrona idzie w parze
          z pracą nad charakterem. Nie chodzi w niej o pokonanie drugiego
          człowieka, lecz o złagodzenie cierpienia i ochronę tego, co dobre.
        </p>

        <p>
          Trenujemy w trzech kierunkach naraz: samoobrony, rozwoju duchowego
          i zdrowia. Stąd zasada, którą powtarzamy każdemu kenshi od pierwszych
          zajęć, czyli „w połowie dla siebie, w połowie dla innych". Fundamentem
          szkoły jest <Link href="/buddyzm" className={linkClass}>buddyzm Kongō Zen</Link>{" "}
          oraz przekonanie, że ciało i umysł rozwijają się razem (Ken Zen Ichinyo).
        </p>

        <p>
          Na macie zaczynamy od podstaw, czyli kihon. Potem przechodzimy do form
          wykonywanych pojedynczo i w parach, a na końcu do embu i randori. Cały{" "}
          <Link href="/program-nauczania" className={linkClass}>program nauczania</Link>{" "}
          wraz z nagraniami zebraliśmy w jednym miejscu.
        </p>

        <p>
          Ćwiczymy w dwóch filiach. <Link href="/zajecia/dzieci" className={linkClass}>Grupa dziecięca</Link>{" "}
          działa w filii Wawel, a <Link href="/zajecia/dorosli" className={linkClass}>grupa dorosła</Link>{" "}
          w filii Kraków. Należymy do światowej organizacji Shorinji Kempo, której
          początek dał <Link href="/organizacja/zalozyciel" className={linkClass}>So Doshin</Link>{" "}
          w 1947 roku w Japonii. To, czym żyjemy teraz, znajdziesz w{" "}
          <Link href="/aktualnosci" className={linkClass}>aktualnościach</Link> oraz{" "}
          <Link href="/galeria" className={linkClass}>galerii</Link>.
        </p>
      </div>

      <div className="mt-12 aspect-[4/3] bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-700 shadow-2xl relative">
        <iframe
          className="absolute inset-0 w-full h-full"
          src="https://www.youtube.com/embed/aXz0wXgKTTk"
          title="Shorinji Kempo Kraków"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </>
  );
}