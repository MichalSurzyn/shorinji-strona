import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cennik",
  description:
    "Lista opłat obowiązująca od 1 kwietnia 2026 do 31 marca 2030 – składki, egzaminy na stopnie Kyu i Dan, opłaty organizacyjne.",
};

type Row = { label: string; price: string; note?: string };

type Section = {
  title: string;
  subtitle?: string;
  rows: Row[];
};

const skladki: Section = {
  title: "Składki regularne",
  subtitle: "Miesięczne opłaty za udział w treningach.",
  rows: [
    { label: "Miesięczna opłata za trening – dzieci", price: "150 zł" },
    { label: "Miesięczna opłata za trening – dorośli", price: "160 zł" },
  ],
};

const organizacyjne: Section = {
  title: "Opłaty organizacyjne",
  subtitle: "Członkostwo w Polskiej Organizacji Shorinji Kempo.",
  rows: [
    { label: "Opłata wpisowa do Organizacji", price: "50 zł" },
    { label: "Odnowienie członkostwa w Organizacji", price: "25 zł" },
    { label: "Roczna opłata członkowska", price: "10 zł" },
    { label: "Przeniesienie z jednej filii do drugiej", price: "15 zł" },
    { label: "Ustanowienie nowej filii", price: "200 zł" },
  ],
};

const egzaminyKyu: Section = {
  title: "Egzaminy na stopnie Kyu",
  subtitle: "Stopnie uczniowskie – od najniższego (8 Kyu) do 1 Kyu.",
  rows: [
    { label: "8 Kyu", price: "50 zł", note: "tylko dzieci do 10. roku życia" },
    { label: "7 Kyu", price: "60 zł", note: "tylko dzieci do 10. roku życia" },
    { label: "6 Kyu", price: "70 zł" },
    { label: "5 Kyu", price: "80 zł" },
    { label: "4 Kyu", price: "90 zł" },
    { label: "3 Kyu", price: "100 zł" },
    { label: "2 Kyu", price: "110 zł" },
    { label: "1 Kyu", price: "120 zł" },
  ],
};

const egzaminyDan: Section = {
  title: "Egzaminy na stopnie Dan",
  subtitle: "Stopnie mistrzowskie – od 1 Dan wzwyż.",
  rows: [
    { label: "1 Dan", price: "200 zł" },
    { label: "2 Dan", price: "300 zł" },
    { label: "3 Dan", price: "400 zł" },
    { label: "4 Dan", price: "500 zł" },
    { label: "5 Dan / Daikenshi", price: "700 zł" },
    { label: "6 Dan / Junhanshi", price: "900 zł" },
    { label: "7 Dan / Seihanshi", price: "1500 zł" },
    { label: "8 Dan / Daihanshi", price: "3000 zł" },
  ],
};

const pozostale: Section = {
  title: "Pozostałe opłaty",
  subtitle: "Powtórne podejścia do egzaminów oraz duplikaty certyfikatów.",
  rows: [
    { label: "Ponowne podejście do egzaminu (1 Dan – 3 Dan)", price: "50 zł" },
    { label: "Ponowne podejście do egzaminu (4 Dan albo wyżej)", price: "100 zł" },
    { label: "Ponowne wydanie certyfikatu dla stopni Kyu", price: "25 zł" },
    { label: "Ponowne wydanie certyfikatu dla stopni Dan", price: "50 zł" },
  ],
};

function PriceTable({ section }: { section: Section }) {
  return (
    <section className="mb-12">
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

      <div className="rounded-xl border border-yellow-500/60 overflow-hidden bg-transparent backdrop-blur-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-yellow-500/10 border-b border-yellow-500/40">
              <th className="px-5 py-3 text-yellow-500 text-xs md:text-sm uppercase tracking-[0.12em] font-semibold">
                Rodzaj opłaty
              </th>
              <th className="px-5 py-3 text-yellow-500 text-xs md:text-sm uppercase tracking-[0.12em] font-semibold text-right whitespace-nowrap">
                Kwota
              </th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, idx) => (
              <tr
                key={row.label}
                className={`transition-colors hover:bg-yellow-500/5 ${
                  idx !== section.rows.length - 1
                    ? "border-b border-yellow-500/15"
                    : ""
                }`}
              >
                <td className="px-5 py-3 text-neutral-200">
                  <span>{row.label}</span>
                  {row.note && (
                    <span className="ml-2 text-xs text-neutral-500 italic">
                      ({row.note})
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-white font-medium whitespace-nowrap">
                  {row.price}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CennikPage() {
  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      <div className="w-[80%] mx-auto z-10 relative">
        {/* Nagłówek strony */}
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Cennik
          </h1>
          <p className="text-neutral-300 text-lg">
            Lista opłat obowiązująca od{" "}
            <span className="text-yellow-500">1 kwietnia 2026</span> do{" "}
            <span className="text-yellow-500">31 marca 2030</span> – kategoria{" "}
            <span className="text-yellow-500">&bdquo;B&rdquo;</span>. Wszystkie
            kwoty podane są w polskich złotych (PLN).
          </p>
        </header>

        {/* Tabele */}
        <PriceTable section={skladki} />
        <PriceTable section={organizacyjne} />
        <PriceTable section={egzaminyKyu} />
        <PriceTable section={egzaminyDan} />
        <PriceTable section={pozostale} />

        {/* Konto bankowe + nota informacyjna */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Konto bankowe */}
          <aside className="rounded-xl border border-yellow-500/60 bg-yellow-500/5 px-6 py-5 backdrop-blur-sm">
            <h3 className="text-yellow-500 text-xs uppercase tracking-[0.14em] font-semibold mb-3">
              Konto bankowe
            </h3>
            <p className="text-white font-medium">
              Stowarzyszenie &bdquo;Polska Organizacja Shorinji Kempo&rdquo;
            </p>
            <p className="text-neutral-300 text-sm mt-1">
              ul. Wysłouchów 33/5, 30-611 Kraków, Polska
            </p>
            <div className="mt-4 pt-4 border-t border-yellow-500/20">
              <p className="text-neutral-400 text-xs uppercase tracking-wider mb-1">
                mBank
              </p>
              <p className="text-white font-mono text-sm md:text-base tracking-wider select-all">
                53 1140 2004 0000 3502 7497 1466
              </p>
            </div>
            <p className="text-neutral-500 text-xs mt-3 italic">
              W tytule przelewu prosimy podać imię, nazwisko oraz cel wpłaty
              (np. składka – kwiecień 2026, egzamin 5 Kyu).
            </p>
          </aside>

          {/* Notka informacyjna */}
          <aside className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 px-6 py-5 text-sm text-neutral-300 leading-relaxed backdrop-blur-sm">
            <p className="mb-2">
              <span className="text-yellow-500 font-semibold">Informacja: </span>
              opłaty miesięczne za treningi prosimy regulować z góry, do
              10. dnia każdego miesiąca. Opłaty egzaminacyjne wnoszone są
              bezpośrednio przed egzaminem.
            </p>
            <p>
              W razie pytań dotyczących płatności zapraszamy do kontaktu –{" "}
              <a
                href="mailto:pl.shorinjikempo@gmail.com"
                className="text-yellow-500 hover:text-yellow-400 transition-colors underline underline-offset-4"
              >
                pl.shorinjikempo@gmail.com
              </a>
              .
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
