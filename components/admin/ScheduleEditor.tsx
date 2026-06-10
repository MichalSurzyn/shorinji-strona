"use client";

import { useState } from "react";
import { resetSchedule, saveSchedule } from "@/actions/scheduleActions";
import { DAY_NAMES, type ScheduleSlot } from "@/data/schedule";

const DAYS: { value: ScheduleSlot["day"]; label: string }[] = (
  [1, 2, 3, 4, 5, 6, 7] as const
).map((d) => ({ value: d, label: DAY_NAMES[d].long }));

export default function ScheduleEditor({
  initialSlots,
  baseSlots,
  overridden,
}: {
  initialSlots: ScheduleSlot[];
  baseSlots: ScheduleSlot[];
  overridden: boolean;
}) {
  const [slots, setSlots] = useState<ScheduleSlot[]>(initialSlots);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function update(i: number, patch: Partial<ScheduleSlot>) {
    setSlots((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

  function remove(i: number) {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
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
    const res = await saveSchedule(slots);
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: "Zapisano. Nowe godziny są już widoczne na stronie." }
        : { ok: false, text: res.error }
    );
  }

  async function handleReset() {
    if (
      !confirm(
        "Przywrócić harmonogram bazowy z kodu strony? Zmiany z panelu zostaną usunięte."
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    const res = await resetSchedule();
    setBusy(false);
    if (res.ok) {
      setSlots(baseSlots);
      setMsg({ ok: true, text: "Przywrócono harmonogram bazowy." });
    } else {
      setMsg({ ok: false, text: res.error });
    }
  }

  const sorted = [...slots].sort(
    (a, b) =>
      (a.group === b.group ? 0 : a.group === "dzieci" ? -1 : 1) ||
      a.day - b.day ||
      a.start.localeCompare(b.start)
  );

  return (
    <div className="space-y-4">
      {overridden && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 text-sm">
          Harmonogram ma zmiany zapisane w panelu (nadpisuje wersję z kodu).
        </p>
      )}
      {msg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((slot) => {
          const i = slots.indexOf(slot);
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
        + Dodaj termin
      </button>

      <div className="flex flex-wrap justify-between gap-3 pt-2">
        <button
          onClick={handleReset}
          disabled={busy}
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          Przywróć wersję bazową
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          type="button"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          {busy ? "Zapisywanie..." : "Zapisz harmonogram"}
        </button>
      </div>
    </div>
  );
}
