"use client";

import { useMemo, useState } from "react";
import { resetSchedule, saveSchedule } from "@/actions/scheduleActions";
import { DAY_NAMES, type ScheduleSlot } from "@/data/schedule";
import { opiszBlad } from "@/lib/adminErrors";
import { czyZmieniono, useUnsavedChanges } from "@/lib/useUnsavedChanges";

const DAYS: { value: ScheduleSlot["day"]; label: string }[] = (
  [1, 2, 3, 4, 5, 6, 7] as const
).map((d) => ({ value: d, label: DAY_NAMES[d].long }));

export default function ScheduleEditor({
  initialSlots,
  baseSlots,
}: {
  initialSlots: ScheduleSlot[];
  baseSlots: ScheduleSlot[];
}) {
  const [slots, setSlots] = useState<ScheduleSlot[]>(initialSlots);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [zapisany, setZapisany] = useState<ScheduleSlot[]>(initialSlots);
  const [cofnij, setCofnij] = useState<{ slot: ScheduleSlot; pozycja: number } | null>(null);

  const zmieniono = czyZmieniono(slots, zapisany);
  useUnsavedChanges(zmieniono, "Grafik zajęć");

  /** Godziny w porządku tygodnia - do podglądu, bez przestawiania pól. */
  const podglad = useMemo(
    () =>
      [...slots].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
    [slots]
  );

  function update(i: number, patch: Partial<ScheduleSlot>) {
    setSlots((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

  function remove(i: number) {
    // Zapamiętujemy usunięte zajęcia, żeby dało się je przywrócić jednym
    // kliknięciem. Bez tego pomyłka oznacza wpisanie wszystkiego od nowa.
    const usuwany = slots[i];
    setCofnij({ slot: usuwany, pozycja: i });
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
  }

  function przywroc() {
    if (!cofnij) return;
    setSlots((prev) => {
      const next = [...prev];
      next.splice(Math.min(cofnij.pozycja, next.length), 0, cofnij.slot);
      return next;
    });
    setCofnij(null);
  }

  function add() {
    const last = slots[slots.length - 1];
    setSlots((prev) => [
      ...prev,
      {
        group: "dorosli",
        day: 2,
        start: "18:00",
        end: "19:30",
        location: last?.location ?? "",
      },
    ]);
  }

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await saveSchedule(slots);
      if (res.ok) {
        setZapisany(slots);
        setCofnij(null);
        setMsg({
          ok: true,
          text: "Zapisano. Nowe godziny są już na stronach zajęć, w kalendarzu do telefonu i w wizytówce Google.",
        });
      } else {
        setMsg({ ok: false, text: opiszBlad(res.error) });
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e) });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (
      !confirm(
        "Przywrócić grafik startowy?\n\nWróci układ zajęć z dnia uruchomienia strony. Wszystkie Twoje zmiany zostaną skasowane."
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await resetSchedule();
      if (res.ok) {
        setSlots(baseSlots);
        setZapisany(baseSlots);
        setCofnij(null);
        setMsg({ ok: true, text: "Przywrócono grafik startowy." });
      } else {
        setMsg({ ok: false, text: opiszBlad(res.error, "przywrócić grafiku") });
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e, "przywrócić grafiku") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {cofnij && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5"
        >
          <span className="text-sm text-slate-600">
            Usunięto zajęcia: {DAY_NAMES[cofnij.slot.day].long}, {cofnij.slot.start}
          </span>
          <button
            type="button"
            onClick={przywroc}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            ↶ Cofnij
          </button>
        </div>
      )}

      {zmieniono && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          Masz niezapisane zmiany. Kliknij „Zapisz&rdquo; na dole, żeby trafiły na stronę.
        </p>
      )}

      {/* Wiersze w stałej kolejności wpisywania.
          Wcześniej lista była sortowana do wyświetlenia, a indeks pola
          wyszukiwany przez indexOf - zmiana dnia albo godziny natychmiast
          przestawiała wiersz w inne miejsce, dosłownie spod kursora.
          Podgląd w kolejności tygodnia jest niżej, osobno. */}
      <div className="space-y-3">
        {slots.map((slot, i) => {
          return (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end"
            >
              <div>
                <label className="block text-xs text-slate-500 mb-1">Grupa</label>
                <select
                  value={slot.group}
                  onChange={(e) =>
                    update(i, { group: e.target.value as ScheduleSlot["group"] })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="dzieci">Dzieci</option>
                  <option value="dorosli">Dorośli</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Dzień</label>
                <select
                  value={slot.day}
                  onChange={(e) =>
                    update(i, {
                      day: Number(e.target.value) as ScheduleSlot["day"],
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Od</label>
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) => update(i, { start: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Do</label>
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) => update(i, { end: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-2 sm:col-span-2 lg:col-span-1">
                <label className="block text-xs text-slate-500 mb-1">
                  Miejsce
                </label>
                <input
                  value={slot.location}
                  onChange={(e) => update(i, { location: e.target.value })}
                  placeholder="Adres sali"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => remove(i)}
                  type="button"
                  className="rounded-lg border border-red-300 text-red-600 px-3 py-2 text-sm hover:bg-red-50 transition-colors"
                  title="Usuń termin"
                >
                  ✕ Usuń
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={add}
        type="button"
        className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        + Dodaj zajęcia
      </button>

      {/* Podgląd w kolejności tygodnia - tak, jak zobaczy to odwiedzający.
          Oddzielony od pól, żeby edycja nie przestawiała wierszy. */}
      {podglad.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900">Tak wygląda tydzień</h3>
          <p className="text-sm text-slate-500 mb-3">
            Kolejność jak na stronie. {zmieniono ? "Uwzględnia niezapisane zmiany." : ""}
          </p>
          <ul className="divide-y divide-slate-100 text-sm">
            {podglad.map((s, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-slate-700">
                  <strong>{DAY_NAMES[s.day].long}</strong> · {s.start}&ndash;{s.end}
                </span>
                <span className="text-slate-500">
                  {s.group === "dzieci" ? "Grupa dziecięca" : "Grupa dorosła"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-3 pt-2">
        <button
          onClick={handleReset}
          disabled={busy}
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          Przywróć grafik startowy
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          type="button"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          {busy ? "Zapisywanie..." : "Zapisz grafik"}
        </button>
      </div>
    </div>
  );
}
