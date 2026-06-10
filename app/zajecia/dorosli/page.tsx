import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import ScheduleWeek from "../../../components/ScheduleWeek";
import LocationMap from "../../../components/LocationMap";
import { getSchedule } from "@/lib/schedule";
import EditableSection from "@/components/EditableSection";

export const metadata: Metadata = {
  title: "Grupa dorosła (Filia Kraków)",
  description:
    "Zajęcia dla młodzieży i dorosłych w krakowskiej filii Shorinji Kempo prowadzone przez Shibucho Dominika Chowańskiego.",
};

export const revalidate = 300;

export default async function ZajeciaDorosliPage() {
  const slots = await getSchedule();
  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      <div className="w-[80%] mx-auto z-10 relative">

        {/* Nagłówek strony */}
        <header className="mb-10">
          <p className="text-yellow-500 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
            Zajęcia · Filia Kraków
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Grupa dorosła
          </h1>
          <p className="text-neutral-300 text-lg ">
            Zajęcia dla młodzieży i dorosłych. Pełny program techniczny – od
            podstaw kihon, przez pracę w parach, formy embu, aż po randori.
          </p>
        </header>

        {/* Karta instruktora */}
        <section className="mb-14 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 items-start">
          <div className="rounded-xl overflow-hidden border border-yellow-500/40 bg-yellow-500/5">
            <Image
              src="https://res.cloudinary.com/dyn3apjzb/image/upload/c_fill,g_auto,w_600,h_720,q_auto,f_auto/Howanski-Hoi-1_p5hbws"
              alt="Dominik Chowański – Shibucho filii Kraków"
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
              Dominik Chowański
            </h2>
            <p className="text-sm text-neutral-400 mt-1 italic">
              Egzaminator oraz Sędzia 2 kategorii
            </p>

            <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Bukai (stopień techniczny)
                </dt>
                <dd className="text-white font-medium">6 Dan</dd>
              </div>
              <div>
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Hokai (poziom duchowy)
                </dt>
                <dd className="text-white font-medium">Daikenshi</dd>
              </div>
              <div>
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Rok urodzenia
                </dt>
                <dd className="text-white font-medium">1974</dd>
              </div>
              <div>
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Kisei (numer kenshi)
                </dt>
                <dd className="text-white font-medium">512</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">
                  Trenuje od
                </dt>
                <dd className="text-white font-medium">1991 roku</dd>
              </div>
            </dl>

            <div className="mt-5 pt-5 border-t border-yellow-500/20 text-sm text-neutral-300">
              <p className="mb-1">
                <span className="text-yellow-500">Lokalizacja: </span>
                ul. Łąkowa 31, Kraków · Szkoła Podstawowa nr 114
              </p>
              <p className="text-neutral-100 italic mt-3">
                Zapisy do grupy dorosłej są obecnie zamknięte.
              </p>
            </div>
          </div>
        </section>

        {/* Opis zajęć (edytowalny z panelu admina) */}
        <section className="mb-14">
          <EditableSection
            slug="zajecia-dorosli"
            fallback={
              <>
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-5">
            Zajęcia dla dorosłych
          </h2>
          <div className="space-y-5 text-neutral-300 leading-relaxed">
            <p>
              Zajęcia w filii <span className="text-yellow-500">Kraków</span>{" "}
              są przeznaczone dla młodzieży i dorosłych. To początek przygody
              młodego <em>kenshi</em> (ucznia szkoły Shorinji Kempo), która
              będzie mu towarzyszyć przez całe życie. Po okresie próbnym
              Mistrz kierujący filią kwalifikuje ucznia do szkoły Shorinji
              Kempo – każdy uczeń otrzymuje indywidualną legitymację wraz ze
              swoim numerem prosto z centrali <em>Hombu</em> w Japonii. Numer
              kenshi zostaje z uczniem przez całe życie – bez względu na to,
              gdzie jest na świecie, zawsze może trenować w każdym Dōjō.
            </p>
            <h3 className="text-xl text-white pt-2">
              Jak wyglądają treningi
            </h3>
            <p>
              Zajęcia składają się z ceremonii wstępnej wraz z medytacją oraz
              odczytaniem tekstów naszej szkoły, następnie przeprowadzona jest
              krótka rozgrzewka. Kolejnym etapem treningu jest praca
              indywidualna bez partnera nad podstawowymi ruchami i technikami
              (<span className="text-yellow-500">kihon</span>). Następnie
              przechodzimy do pracy w parach – to, co przećwiczyliśmy
              indywidualnie, trenujemy z partnerem. Kładziemy duży nacisk na
              pracę w parach, ćwiczymy każdy z każdym.
            </p>
            <p>
              Podczas zajęć wykonujemy ćwiczenia wzmacniające, rozciągające
              oraz korygujące postawę. Dodatkowo adepci ćwiczą formy
              pojedynczo i w parach. Kolejny element to{" "}
              <span className="text-yellow-500">embu</span> oraz{" "}
              <span className="text-yellow-500">randori</span>: embu to
              wyjątkowy układ technik wykonywany w parach z pełną szybkością
              i precyzją, a randori to realistyczna walka z wykorzystaniem
              wcześniej poznanych technik. Zajęcia prowadzą doświadczeni
              instruktorzy z wieloletnim stażem, finaliści mistrzostw Europy
              w Shorinji Kempo.
            </p>
          </div>
              </>
            }
          />
        </section>

        {/* Tygodniowy plan zajęć */}
        <ScheduleWeek group="dorosli" slots={slots} />

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
            href="/downloads/deklaracja-dorosli.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-yellow-500/60 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors px-5 py-4 text-white"
          >
            <div className="text-xs uppercase tracking-wider text-yellow-500">
              Deklaracja członkowska
            </div>
            <div className="mt-1 font-semibold">Pobierz PDF (dorośli) →</div>
          </Link>
          <a
            href="mailto:pl.shorinjikempo@gmail.com?subject=Zapis%20na%20zaj%C4%99cia%20%E2%80%94%20grupa%20doros%C5%82a"
            className="rounded-xl border border-yellow-500/60 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors px-5 py-4 text-white"
          >
            <div className="text-xs uppercase tracking-wider text-yellow-500">
              Kontakt
            </div>
            <div className="mt-1 font-semibold">Napisz do nas →</div>
          </a>
        </aside>

      </div>
    </div>
  );
}
