import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Program nauczania – Shorinji Kempo Kraków",
  description:
    "Materiały wideo Shorinji Kempo: kihon, kata, embu, randori. Tan'en Kihon Hokei – jednoosobowe i parami.",
};

type VideoLink = { label: string; url: string; note?: string };

type Section = {
  title: string;
  subtitle?: string;
  videos: VideoLink[];
};

const sections: Section[] = [
  {
    title: "Podstawy / kihon",
    subtitle:
      "Pozycje, uderzenia, kopnięcia, bloki i pady (ukemi). To fundament, do którego wracamy na każdym treningu.",
    videos: [
      { label: "Jak zawiązać pas?", url: "https://www.youtube.com/watch?v=9luFLV52N_8" },
      { label: "Byakuren Hachijin", url: "https://www.youtube.com/watch?v=N_58F3VSTCs" },
      { label: "Giwa Kyujin", url: "https://www.youtube.com/watch?v=jVAFSTNBaeg" },
      { label: "Daisharin 1", url: "https://www.youtube.com/watch?v=j1BxnNqWQq8" },
      { label: "Daisharin 2", url: "https://www.youtube.com/watch?v=9ND4Rq2udis" },
      { label: "Mae Ukemi 1", url: "https://www.youtube.com/watch?v=Yjo6hWxax1Y" },
      { label: "Mae Ukemi 2", url: "https://www.youtube.com/watch?v=5Khzb_hVJ6k" },
      { label: "Ushiro Ukemi", url: "https://www.youtube.com/watch?v=b1IP0JDAmq8" },
      { label: "Ukemi po Kari Ashi", url: "https://www.youtube.com/watch?v=lcoIM2Yb6WQ" },
      { label: "Uwa Uke, Shita Uke, Jo Chu Niren Uke", url: "https://www.youtube.com/watch?v=jrPthlW2GS0" },
      { label: "Keri Age", url: "https://www.youtube.com/watch?v=XHDLXs3JIRo" },
      { label: "Kinteki Geri, Keri Age, Sokuto Geri", url: "https://www.youtube.com/watch?v=W9k8VoxA0Vc" },
    ],
  },
  {
    title: "Tan'en Kihon Hokei – formy jednoosobowe",
    subtitle:
      "Formy podstawowe wykonywane pojedynczo (tan'en znaczy „samemu\"). Uczą całych sekwencji technik, zanim przećwiczysz je z partnerem.",
    videos: [
      { label: "Tenchiken Dai Ikkei", url: "https://www.youtube.com/watch?v=OxkSM4L_DLc" },
      { label: "Tenchiken Dai Nikei", url: "https://www.youtube.com/watch?v=Pq-JIjllo8k" },
      { label: "Tenchiken Dai Sankei", url: "https://www.youtube.com/watch?v=0QgM-EZM8js" },
      { label: "Tenchiken Dai Yonkei", url: "https://www.youtube.com/watch?v=d478l3D6Kg0" },
      { label: "Tenchiken Dai Gokei", url: "https://www.youtube.com/watch?v=H6uya_NqW6U" },
      { label: "Tenchiken Dai Rokkei", url: "https://www.youtube.com/watch?v=ACaMYW3no4g" },
      { label: "Giwaken Dai Ikkei", url: "https://www.youtube.com/watch?v=PaFaxqM5qbk" },
      { label: "Manji-no Kata", url: "https://www.youtube.com/watch?v=0gBUjdsjO38" },
      { label: "Ryu-no Kata", url: "https://www.youtube.com/watch?v=QHkBt8zYiFM" },
    ],
  },
  {
    title: "Sotai – formy w parach",
    subtitle:
      "Te same formy podstawowe, ale wykonywane w parach (sotai). Dochodzi realny dystans, timing i kontakt z partnerem.",
    videos: [
      { label: "Tenchiken Dai Ikkei", url: "https://www.youtube.com/watch?v=IyKJ-IEY2fU" },
      { label: "Tenchiken Dai Nikei", url: "https://www.youtube.com/watch?v=GesgymAIyvA" },
      { label: "Giwaken Dai Ikkei", url: "https://www.youtube.com/watch?v=Odr7Af9KZa8" },
      { label: "Ryuoken Dai Ikkei", url: "https://www.youtube.com/watch?v=XjXCKDr_yc0" },
    ],
  },
];

export default function ProgramNauczaniaPage() {
  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      <div className="w-[80%] mx-auto z-10 relative">

        <header className="mb-10">
          <p className="text-yellow-500 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
            Materiały szkoleniowe
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Program nauczania
          </h1>
          <p className="text-neutral-300 text-lg max-w-3xl">
            Nagrania, z których korzystamy podczas treningów – od pierwszych
            technik i przewrotów, przez formy wykonywane pojedynczo, po pracę
            w parach. Filmy pomagają utrwalić materiał między zajęciami, nie
            zastępują jednak treningu z instruktorem. Każdy link otwiera
            nagranie na YouTube.
          </p>
        </header>

        {sections.map((section, idx) => (
          <section key={idx} className="mb-12">
            <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-wide">
                  {section.title}
                </h2>
                {section.subtitle && (
                  <p className="mt-1 text-sm text-neutral-400">{section.subtitle}</p>
                )}
              </div>
              <div className="h-px flex-1 bg-yellow-500/30 hidden md:block" />
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.videos.map((v) => (
                <li key={v.url}>
                  <Link
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-5 h-5 text-yellow-500 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                      <span className="text-white text-sm font-medium group-hover:text-yellow-100 transition-colors">
                        {v.label}
                      </span>
                    </div>
                    {v.note && (
                      <div className="mt-1 text-xs text-neutral-500 italic">{v.note}</div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

      </div>
    </div>
  );
}
