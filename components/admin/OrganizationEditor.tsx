"use client";

import { useState } from "react";
import { saveOrganization } from "@/actions/organizationActions";
import { opiszBlad } from "@/lib/adminErrors";
import { czyZmieniono, useUnsavedChanges } from "@/lib/useUnsavedChanges";
import {
  czyPoprawnyIban,
  czyPoprawnyNip,
  formatIban,
  formatTelefon,
  normalizujIban,
  type OrganizationData,
} from "@/lib/organizationTypes";
import PasekAkcji from "./PasekAkcji";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Pole({
  etykieta,
  podpowiedz,
  wartosc,
  onChange,
  typ = "text",
  blad,
  szeroki = false,
}: {
  etykieta: string;
  podpowiedz?: string;
  wartosc: string;
  onChange: (v: string) => void;
  typ?: string;
  blad?: string | null;
  szeroki?: boolean;
}) {
  return (
    <div className={szeroki ? "sm:col-span-2" : undefined}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{etykieta}</label>
      {podpowiedz && <p className="text-xs text-slate-500 mb-1.5">{podpowiedz}</p>}
      <input
        type={typ}
        value={wartosc}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} ${blad ? "border-red-400 bg-red-50" : ""}`}
        aria-invalid={!!blad}
      />
      {blad && (
        <p role="alert" className="text-xs text-red-700 mt-1">
          {blad}
        </p>
      )}
    </div>
  );
}

function Sekcja({
  tytul,
  opis,
  children,
  domyslnieOtwarta = true,
}: {
  tytul: string;
  opis: string;
  children: React.ReactNode;
  domyslnieOtwarta?: boolean;
}) {
  return (
    <details
      open={domyslnieOtwarta}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
    >
      <summary className="cursor-pointer select-none px-5 py-4 hover:bg-slate-50 transition-colors">
        <span className="font-bold text-slate-900">{tytul}</span>
        <span className="block text-sm text-slate-500 mt-0.5">{opis}</span>
      </summary>
      <div className="px-5 pb-5 grid sm:grid-cols-2 gap-4">{children}</div>
    </details>
  );
}

export default function OrganizationEditor({ initial }: { initial: OrganizationData }) {
  const [dane, setDane] = useState<OrganizationData>(initial);
  const [zapisany, setZapisany] = useState<OrganizationData>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const zmieniono = czyZmieniono(dane, zapisany);
  useUnsavedChanges(zmieniono, "Dane organizacji");

  // Zmiana pojedynczego pola wewnątrz sekcji, bez rozjeżdżania reszty.
  function ustaw<K extends keyof OrganizationData>(
    sekcja: K,
    patch: Partial<OrganizationData[K]>
  ) {
    setDane((p) => ({ ...p, [sekcja]: { ...(p[sekcja] as object), ...patch } }));
  }

  const ibanBlad =
    dane.bank.iban.trim() && !czyPoprawnyIban(dane.bank.iban)
      ? "Ten numer nie przechodzi kontroli poprawności. Sprawdź, czy nie ma literówki."
      : null;
  const nipBlad = !czyPoprawnyNip(dane.rejestr.nip)
    ? "Ten numer NIP nie przechodzi kontroli poprawności."
    : null;

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await saveOrganization(dane);
      if (res.ok) {
        setZapisany(dane);
        setMsg({
          ok: true,
          text: "Zapisano. Dane są już w stopce, na stronie Kontakt, na mapie i w wizytówce Google.",
        });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PasekAkcji
        tytul="Dane organizacji"
        opis="Wpisane raz, pojawiają się w stopce, na Kontakcie, na mapie, w cenniku i w wizytówce Google."
        zmieniono={zmieniono}
        busy={busy}
        onZapisz={handleSave}
      />

      {msg && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.ok
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <Sekcja
        tytul="Kontakt do klubu"
        opis="Najczęściej zmieniane dane. Widoczne w stopce i na stronie Kontakt."
      >
        <Pole
          etykieta="Telefon"
          podpowiedz={`Wpisz z numerem kierunkowym kraju. Na stronie pokaże się jako: ${formatTelefon(dane.kontakt.telefon)}`}
          wartosc={dane.kontakt.telefon}
          onChange={(v) => ustaw("kontakt", { telefon: v })}
        />
        <Pole
          etykieta="Adres e-mail"
          podpowiedz="Na ten adres piszą osoby zainteresowane zajęciami."
          typ="email"
          wartosc={dane.kontakt.email}
          onChange={(v) => ustaw("kontakt", { email: v })}
        />
      </Sekcja>

      <Sekcja
        tytul="Miejsce zajęć"
        opis="Sala, w której odbywają się treningi. To NIE jest adres siedziby stowarzyszenia."
      >
        <Pole
          etykieta="Nazwa obiektu"
          podpowiedz="Np. nazwa szkoły, w której wynajmujecie salę."
          szeroki
          wartosc={dane.miejsceZajec.nazwaPelna}
          onChange={(v) => ustaw("miejsceZajec", { nazwaPelna: v })}
        />
        <Pole
          etykieta="Ulica i numer"
          podpowiedz="Ten adres trafia na mapę dojazdu i do wizytówki Google."
          wartosc={dane.miejsceZajec.adres.ulica}
          onChange={(v) =>
            ustaw("miejsceZajec", { adres: { ...dane.miejsceZajec.adres, ulica: v } })
          }
        />
        <Pole
          etykieta="Kod pocztowy i miasto"
          wartosc={`${dane.miejsceZajec.adres.kodPocztowy} ${dane.miejsceZajec.adres.miasto}`.trim()}
          onChange={(v) => {
            const m = v.match(/^\s*(\d{2}-\d{3})?\s*(.*)$/);
            ustaw("miejsceZajec", {
              adres: {
                ...dane.miejsceZajec.adres,
                kodPocztowy: m?.[1] ?? "",
                miasto: (m?.[2] ?? "").trim(),
              },
            });
          }}
        />
      </Sekcja>

      <Sekcja
        tytul="Numer konta do wpłat"
        opis="Widoczny w cenniku. Pomyłka o jeden znak oznacza pieniądze na cudzym koncie, dlatego numer jest sprawdzany."
      >
        <Pole
          etykieta="Numer konta (IBAN)"
          podpowiedz={
            dane.bank.iban && !ibanBlad
              ? `Poprawny. Na stronie pokaże się jako: ${formatIban(dane.bank.iban)}`
              : "Możesz wpisać ze spacjami - poprawimy zapis sami."
          }
          szeroki
          wartosc={dane.bank.iban}
          onChange={(v) => ustaw("bank", { iban: normalizujIban(v) })}
          blad={ibanBlad}
        />
        <Pole
          etykieta="Odbiorca przelewu"
          podpowiedz="Nazwa, którą wpłacający wpisze w polu odbiorcy."
          wartosc={dane.bank.odbiorca}
          onChange={(v) => ustaw("bank", { odbiorca: v })}
        />
        <Pole
          etykieta="Nazwa banku"
          podpowiedz="Opcjonalnie. Puste pole - w cenniku pokaże się sam numer."
          wartosc={dane.bank.nazwaBanku}
          onChange={(v) => ustaw("bank", { nazwaBanku: v })}
        />
      </Sekcja>

      <Sekcja
        tytul="Profile w mediach społecznościowych"
        opis="Puste pole oznacza, że ikona nie pojawi się w stopce."
      >
        <Pole
          etykieta="Facebook"
          wartosc={dane.social.facebook}
          onChange={(v) => ustaw("social", { facebook: v })}
        />
        <Pole
          etykieta="Instagram"
          wartosc={dane.social.instagram}
          onChange={(v) => ustaw("social", { instagram: v })}
        />
        <Pole
          etykieta="YouTube"
          wartosc={dane.social.youtube}
          onChange={(v) => ustaw("social", { youtube: v })}
        />
      </Sekcja>

      <Sekcja
        tytul="Nazwa i opis strony"
        opis="Widoczne w wynikach wyszukiwania i przy udostępnianiu odnośnika."
        domyslnieOtwarta={false}
      >
        <Pole
          etykieta="Nazwa strony"
          podpowiedz="Krótka nazwa, np. w tytule karty przeglądarki."
          wartosc={dane.nazwy.serwis}
          onChange={(v) => ustaw("nazwy", { serwis: v })}
        />
        <Pole
          etykieta="Nazwa w stopce po znaku ©"
          podpowiedz="Rok dopisuje się sam."
          wartosc={dane.nazwy.wStopce}
          onChange={(v) => ustaw("nazwy", { wStopce: v })}
        />
        <Pole
          etykieta="Opis strony"
          podpowiedz="Dwa, trzy zdania. To one pokazują się pod tytułem w wynikach Google."
          szeroki
          wartosc={dane.nazwy.opis}
          onChange={(v) => ustaw("nazwy", { opis: v })}
        />
      </Sekcja>

      <Sekcja
        tytul="Dane formalne stowarzyszenia"
        opis="Potrzebne do polityki prywatności i informacji dla odwiedzających. Zmieniają się bardzo rzadko."
        domyslnieOtwarta={false}
      >
        <Pole
          etykieta="Pełna nazwa z rejestru"
          szeroki
          wartosc={dane.nazwy.prawna}
          onChange={(v) => ustaw("nazwy", { prawna: v })}
        />
        <Pole
          etykieta="Adres siedziby"
          podpowiedz="Adres z rejestru - zwykle inny niż miejsce zajęć."
          wartosc={dane.siedziba.adres.ulica}
          onChange={(v) => ustaw("siedziba", { adres: { ...dane.siedziba.adres, ulica: v } })}
        />
        <Pole
          etykieta="Kod pocztowy i miasto siedziby"
          wartosc={`${dane.siedziba.adres.kodPocztowy} ${dane.siedziba.adres.miasto}`.trim()}
          onChange={(v) => {
            const m = v.match(/^\s*(\d{2}-\d{3})?\s*(.*)$/);
            ustaw("siedziba", {
              adres: {
                ...dane.siedziba.adres,
                kodPocztowy: m?.[1] ?? "",
                miasto: (m?.[2] ?? "").trim(),
              },
            });
          }}
        />
        <Pole
          etykieta="KRS"
          podpowiedz="10 cyfr, razem z zerami na początku."
          wartosc={dane.rejestr.krs}
          onChange={(v) => ustaw("rejestr", { krs: v })}
        />
        <Pole
          etykieta="NIP"
          podpowiedz="10 cyfr."
          wartosc={dane.rejestr.nip}
          onChange={(v) => ustaw("rejestr", { nip: v })}
          blad={nipBlad}
        />
        <Pole
          etykieta="REGON"
          podpowiedz="9 albo 14 cyfr."
          wartosc={dane.rejestr.regon}
          onChange={(v) => ustaw("rejestr", { regon: v })}
        />
        <Pole
          etykieta="Sąd rejestrowy"
          podpowiedz="Np. Sąd Rejonowy dla Krakowa-Śródmieścia, XI Wydział Gospodarczy KRS."
          szeroki
          wartosc={dane.siedziba.sadRejestrowy}
          onChange={(v) => ustaw("siedziba", { sadRejestrowy: v })}
        />
        <Pole
          etykieta="E-mail do spraw danych osobowych"
          podpowiedz="Opcjonalnie. Puste pole - używany będzie zwykły adres klubu."
          typ="email"
          szeroki
          wartosc={dane.emailDaneOsobowe}
          onChange={(v) => setDane((p) => ({ ...p, emailDaneOsobowe: v }))}
        />
      </Sekcja>

    </div>
  );
}
