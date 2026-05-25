import {
  DAY_NAMES,
  SCHEDULE,
  type ScheduleGroup,
  type ScheduleSlot,
} from "../data/schedule";

/**
 * Tygodniowy plan zajęć w stylu strony.
 * – Statyczna siatka 7 kolumn (poniedziałek – niedziela).
 * – Każdy blok zajęć jest klikalny i otwiera Google Calendar
 *   z prefillem (RRULE: cotygodniowe powtarzanie).
 * – Pod siatką: jeden przycisk pobierający cały plan jako plik .ics
 *   – wystarczy zaimportować w Google Calendar (Ustawienia → Importuj),
 *     żeby mieć wszystkie zajęcia naraz.
 */

type Props = {
  group: ScheduleGroup;
  /** Nadpisuje domyślne dane jeśli chcesz pokazać własny zestaw slotów. */
  slots?: ScheduleSlot[];
  /** Tytuł nad siatką (np. "Plan zajęć – grupa dziecięca"). */
  title?: string;
};

const GROUP_LABEL: Record<ScheduleGroup, string> = {
  dzieci: "grupa dziecięca",
  dorosli: "grupa dorosła",
};

/** Znajduje kolejne wystąpienie podanego dnia tygodnia (1 = pon … 7 = nd). */
function nextOccurrence(day: number, start: string, end: string) {
  const now = new Date();
  const todayIso = ((now.getDay() + 6) % 7) + 1; // JS: 0=nd → ISO: 7
  let diff = (day - todayIso + 7) % 7;
  if (diff === 0) {
    const [eh, em] = end.split(":").map(Number);
    const endTodayMin = eh * 60 + em;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin > endTodayMin) diff = 7;
  }
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startDate = new Date(target);
  startDate.setHours(sh, sm, 0, 0);
  const endDate = new Date(target);
  endDate.setHours(eh, em, 0, 0);
  return { startDate, endDate };
}

/** Format wymagany przez GCal: YYYYMMDDTHHMMSS w czasie lokalnym. */
function gcalDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
    `${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

function gcalLink(slot: ScheduleSlot, groupLabel: string) {
  const { startDate, endDate } = nextOccurrence(slot.day, slot.start, slot.end);
  const text = `Shorinji Kempo – ${groupLabel}`;
  const dates = `${gcalDate(startDate)}/${gcalDate(endDate)}`;
  const details = `Trening Shorinji Kempo (${groupLabel}).`;
  const recur = "RRULE:FREQ=WEEKLY";
  const params = new URLSearchParams({
    text,
    dates,
    details,
    location: slot.location,
    recur,
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`;
}

export default function ScheduleWeek({ group, slots, title }: Props) {
  const groupLabel = GROUP_LABEL[group];
  const data = (slots ?? SCHEDULE).filter((s) => s.group === group);

  const byDay = new Map<number, ScheduleSlot[]>();
  for (const slot of data) {
    const arr = byDay.get(slot.day) ?? [];
    arr.push(slot);
    byDay.set(slot.day, arr);
  }

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="mb-10 text-2xl md:text-3xl font-semibold text-white tracking-wide">
            {title ?? `Plan zajęć – ${groupLabel}`}
          </h2>

        </div>
        <div className="h-px flex-1 bg-yellow-500/30 hidden md:block" />
      </div>

      {/* Siatka 7 kolumn (na mobile zwija się w 2/3 kolumny) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const daySlots = byDay.get(day) ?? [];
          const hasClasses = daySlots.length > 0;
          return (
            <div
              key={day}
              className={`rounded-lg border backdrop-blur-sm p-3 min-h-[160px] flex flex-col ${
                hasClasses
                  ? "border-yellow-500/60 bg-yellow-500/5"
                  : "border-neutral-800 bg-transparent"
              }`}
            >
              <div className="text-xs uppercase tracking-[0.14em] text-yellow-500 font-semibold mb-3">
                {DAY_NAMES[day].long}
              </div>

              {hasClasses ? (
                <div className="space-y-3 flex-1">
                  {daySlots.map((slot, idx) => (
                    <a
                      key={`${slot.start}-${idx}`}
                      href={gcalLink(slot, groupLabel)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-md border border-yellow-500/40 hover:border-yellow-500 bg-yellow-500/0 hover:bg-yellow-500/10 transition-colors px-3 py-2 group"
                    >
                      <div className="text-white font-mono text-sm font-medium">
                        {slot.start} – {slot.end}
                      </div>
                      {slot.note && (
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {slot.note}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-neutral-600 italic flex-1 flex items-center">
                  brak zajęć
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Jeden przycisk: pobierz cały plan jako .ics → import do Google Calendar */}
      <div className="mt-6 flex justify-center">
        <a
          href={`/api/schedule/${group}/calendar.ics`}
          download={`shorinji-kempo-${group}.ics`}
          className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/60 bg-yellow-500/10 hover:bg-yellow-500/20 hover:border-yellow-500 transition-colors px-5 py-3 text-sm font-semibold text-white"
        >
          <svg
            className="w-5 h-5 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Dodaj plan do Google Calendar (pobierz .ics)
        </a>
      </div>
    </section>
  );
}
