import { NextResponse } from "next/server";
import { SCHEDULE, type ScheduleGroup, type ScheduleSlot } from "../../../../../data/schedule";

const GROUP_LABEL: Record<ScheduleGroup, string> = {
  dzieci: "grupa dziecięca",
  dorosli: "grupa dorosła",
};

const DAY_TO_BYDAY: Record<number, string> = {
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
  7: "SU",
};

/** Pierwsze wystąpienie danego dnia tygodnia (1=pn … 7=nd) od dzisiaj. */
function firstOccurrence(day: number): Date {
  const now = new Date();
  const todayIso = ((now.getDay() + 6) % 7) + 1;
  const diff = (day - todayIso + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return target;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Format ICS w "floating local time" + TZID. */
function fmtLocal(d: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(h)}${pad(m)}00`
  );
}

/** DTSTAMP w UTC (Z). */
function fmtUtcNow(): string {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape pól tekstowych ICS (\, ; , i nowe linie). */
function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildEvent(slot: ScheduleSlot, groupLabel: string, idx: number): string {
  const first = firstOccurrence(slot.day);
  const dtStart = fmtLocal(first, slot.start);
  const dtEnd = fmtLocal(first, slot.end);
  const byday = DAY_TO_BYDAY[slot.day];
  const uid = `shorinji-${slot.group}-${slot.day}-${slot.start.replace(":", "")}-${idx}@shorinjikempo.pl`;
  const summary = `Shorinji Kempo – ${groupLabel}`;
  const description = slot.note
    ? `Trening Shorinji Kempo (${groupLabel}). ${slot.note}`
    : `Trening Shorinji Kempo (${groupLabel}).`;

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtUtcNow()}`,
    `DTSTART;TZID=Europe/Warsaw:${dtStart}`,
    `DTEND;TZID=Europe/Warsaw:${dtEnd}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(slot.location)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "END:VEVENT",
  ].join("\r\n");
}

/** Minimalna definicja strefy Europe/Warsaw (DST od 1996 onwards). */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Warsaw",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19960331T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19961027T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ group: string }> },
) {
  const { group } = await params;
  if (group !== "dzieci" && group !== "dorosli") {
    return new NextResponse("Unknown group", { status: 404 });
  }

  const groupTyped = group as ScheduleGroup;
  const groupLabel = GROUP_LABEL[groupTyped];
  const slots = SCHEDULE.filter((s) => s.group === groupTyped);

  const events = slots.map((slot, idx) => buildEvent(slot, groupLabel, idx));

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shorinji Kempo Kraków//Plan zajęć//PL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Shorinji Kempo – ${groupLabel}`,
    "X-WR-TIMEZONE:Europe/Warsaw",
    VTIMEZONE,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="shorinji-kempo-${group}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
