import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import ScheduleWeek from "../../../components/ScheduleWeek";
import LocationMap from "../../../components/LocationMap";

export const metadata: Metadata = {
  title: "Grupa dziecięca (Filia Wawel)",
  description:
    "Zajęcia dla dzieci i młodzieży (5–13 lat) w krakowskiej filii Wawel Shorinji Kempo prowadzone przez Shibucho Krzysztofa Kmiecika.",
};


export default function ZajeciaDzieciPage() {
  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      <div className="w-[80%] mx-auto z-10 relative">

        {/* Nagłówek strony */}
        <header className="mb-10">
          <p className="text-yellow-500 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
            Zajęcia · Filia Wawel
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Grupa dziecięca
          </h1>
          <p className="text-neutral-300 text-lg ">
            Zajęcia dla dzieci i młodzieży w wieku{" "}
            <span className="text-yellow-500">5–13 lat</span>. Bezpieczne,
            zabawne i wymagające – początek przygody, która może trwać
            całe życie.
          </p>
        </header>

        {/* Karta instruktora */}
        <section className="mb-14 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 items-start">
          <div className="rounded-xl overflow-hidden border border-yellow-500/40 bg-yellow-500/5">
            <Image
              src="https://res.cloudinary.com/dyn3apjzb/image/upload/c_fill,g_auto,w_600,h_720,q_auto,f_auto/20220918_112600_edited_edited_edited_edited_edited_edited_edited_edited_edited_edited_edited_idlhxz"
              alt="Krzysztof Kmiecik – Shibucho filii Wawel"
              width={600}
              height={720}
              className="w-full h-auto object-cover"
            />
          </div>

          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 backdrop-blur-sm p-6">
            <p className="text-yellow-500 text-xs uppercase tracking-[0.14em] font-semibold mb-1">
              Shibucho – mistrz kierujący filią
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-wide">
              Krzysztof Kmiecik
            </h2>

            <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Bukai (stopień techniczny)
                </dt>
                <dd className="text-white font-medium">4 Dan</dd>
              </div>
              <div>
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Hokai (poziom duchowy)
                </dt>
                <dd className="text-white font-medium">Seikenshi</dd>
              </div>
              <div>
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Rok urodzenia
                </dt>
                <dd className="text-white font-medium">1981</dd>
              </div>
              <div>
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Kisei (numer kenshi)
                </dt>
                <dd className="text-white font-medium">766</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Trenuje od
                </dt>
                <dd className="text-white font-medium">2013 roku</dd>
              </div>
            </dl>

            <div className="mt-5 pt-5 border-t border-yellow-500/20 text-sm text-neutral-300 space-y-1">
              <p>
                <span className="text-yellow-500">Lokalizacja: </span>
                ul. Łąkowa 31, Kraków · Szkoła Podstawowa nr 114
              </p>
              <p>
                <span className="text-yellow-500">Tel: </span>
                <a
                  href="tel:+48792995510"
                  className="hover:text-yellow-400 transition-colors"
                >
                  792 99 55 10
                </a>
              </p>
              <p>
                <span className="text-yellow-500">E-mail: </span>
                <a
                  href="mailto:pl.shorinjikempo@gmail.com"
                  className="hover:text-yellow-400 transition-colors"
                >
                  pl.shorinjikempo@gmail.com
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Opis zajęć */}
        <section className="mb-14">
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-5">
            Zajęcia dla dzieci
          </h2>
          <div className="space-y-5 text-neutral-300 leading-relaxed">
            <p>
              Zajęcia w filii <span className="text-yellow-500">Wawel</span>{" "}
              są przeznaczone dla dzieci i młodzieży w wieku{" "}
              <span className="text-yellow-500">5–13 lat</span>. To początek
              przygody młodego <em>kenshi</em> (ucznia szkoły Shorinji Kempo),
              która będzie mu towarzyszyć przez całe życie. Po okresie
              próbnym Mistrz kierujący filią kwalifikuje ucznia do szkoły
              Shorinji Kempo – każdy uczeń otrzymuje indywidualną
              legitymację wraz ze swoim numerem prosto z centrali{" "}
              <em>Hombu</em> w Japonii. To pierwsze, jakże ważne wydarzenie
              dla każdego kenshi! Numer kenshi zostaje z uczniem przez całe
              życie – bez względu na to, gdzie jest na świecie, zawsze może
              trenować w każdym Dōjō.
            </p>
            <h3 className="text-xl text-white pt-2">
              Jak wyglądają treningi
            </h3>
            <p>
              Zajęcia składają się z krótkiej ceremonii wstępnej, potem
              medytacji, następnie przeprowadzona jest krótka rozgrzewka.
              Kolejnym etapem jest praca indywidualna bez partnera nad
              podstawowymi ruchami i technikami (
              <span className="text-yellow-500">kihon</span>), a następnie
              praca w parach – to, co przećwiczyliśmy indywidualnie, trenujemy
              z partnerem. Kładziemy duży nacisk na pracę w parach: ćwiczymy
              każdy z każdym.
            </p>
            <p>
              Podczas zajęć wykonujemy ćwiczenia wzmacniające, rozciągające
              i korygujące dla prawidłowej postawy. Dodatkowo młodzi adepci
              ćwiczą formy pojedynczo i w parach. Zajęcia prowadzą bardzo
              doświadczeni instruktorzy z wieloletnim stażem, finaliści
              mistrzostw Europy w Shorinji Kempo.
            </p>
          </div>
        </section>

        {/* Tygodniowy plan zajęć */}
        <ScheduleWeek group="dzieci" />

        <LocationMap heading="Lokalizacja i dojazd" showContact={false} className="mb-12" />

        {/* CTA na dole */}
        <aside className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/cennik"
            className="rounded-xl border border-yellow-500/60 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors px-5 py-4 text-white"
          >
            <div className="text-xs uppercase tracking-wider text-yellow-500">
              Cennik
            </div>
            <div className="mt-1 font-semibold">Składki i opłaty →</div>
          </Link>
          <Link
            href="/downloads/deklaracja-do-18.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-yellow-500/60 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors px-5 py-4 text-white"
          >
            <div className="text-xs uppercase tracking-wider text-yellow-500">
              Deklaracja członkowska
            </div>
            <div className="mt-1 font-semibold">Pobierz PDF (do 18 lat) →</div>
          </Link>
          <a
            href="mailto:pl.shorinjikempo@gmail.com?subject=Zapis%20na%20zaj%C4%99cia%20%E2%80%94%20grupa%20dzieci%C4%99ca"
            className="rounded-xl border border-yellow-500/60 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors px-5 py-4 text-white"
          >
            <div className="text-xs uppercase tracking-wider text-yellow-500">
              Kontakt
            </div>
            <div className="mt-1 font-semibold">Zapisz dziecko →</div>
          </a>
        </aside>

      </div>
    </div>
  );
}
