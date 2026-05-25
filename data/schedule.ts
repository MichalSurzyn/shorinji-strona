// Stałe godziny zajęć w obu filiach. Format godziny: "HH:MM".
// Pole `day` to numer dnia tygodnia w stylu ISO (1 = poniedziałek, 7 = niedziela).

export type ScheduleGroup = "dzieci" | "dorosli";

export type ScheduleSlot = {
  group: ScheduleGroup;
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  start: string;
  end: string;
  location: string;
  note?: string;
};

export const DAY_NAMES: Record<number, { short: string; long: string }> = {
  1: { short: "Pn", long: "Poniedziałek" },
  2: { short: "Wt", long: "Wtorek" },
  3: { short: "Śr", long: "Środa" },
  4: { short: "Cz", long: "Czwartek" },
  5: { short: "Pt", long: "Piątek" },
  6: { short: "So", long: "Sobota" },
  7: { short: "Nd", long: "Niedziela" },
};

const LOCATION = "ul. Łąkowa 31, Kraków – Szkoła Podstawowa nr 114";

// Wszystkie zajęcia w jednym miejscu – łatwo edytować lub dorzucić nowe.
export const SCHEDULE: ScheduleSlot[] = [
  // Grupa dziecięca – wtorek i czwartek 18:00–19:30
  { group: "dzieci",  day: 2, start: "18:00", end: "19:30", location: LOCATION },
  { group: "dzieci",  day: 4, start: "18:00", end: "19:30", location: LOCATION },

  // Grupa dorosła – wtorek i czwartek 19:30–21:30
  { group: "dorosli", day: 2, start: "19:30", end: "21:30", location: LOCATION },
  { group: "dorosli", day: 4, start: "19:30", end: "21:30", location: LOCATION },
  // Niedziela – trening dłuższy 18:00–21:00
  { group: "dorosli", day: 7, start: "18:00", end: "21:00", location: LOCATION },
];

export const CONTACT_EMAIL_FOR_SCHEDULE = "pl.shorinjikempo@gmail.com";
