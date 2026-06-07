// Aktualności – na razie wpisy na sztywno.
// Docelowo: panel administracyjny + baza (np. Supabase),
// wtedy ten plik zastąpi pobieranie z bazy.

export type NewsItem = {
  /** Data w formacie ISO (do sortowania). */
  date: string;
  /** Data wyświetlana użytkownikowi. */
  dateLabel: string;
  title: string;
  /** Opcjonalne rozwinięcie wpisu na stronie /aktualnosci. */
  body?: string;
};

export const news: NewsItem[] = [
  {
    date: "2026-02-22",
    dateLabel: "22 lutego 2026",
    title: "Seminarium z mistrzem z Japonii już w ten weekend!",
    body: "Szczegóły przekazujemy na treningach oraz w naszych mediach społecznościowych.",
  },
  {
    date: "2026-02-15",
    dateLabel: "15 lutego 2026",
    title: "Zmiana harmonogramu treningów grupy dziecięcej.",
    body: "Aktualne godziny zajęć znajdziesz w zakładce Zajęcia → Grupa dziecięca.",
  },
  {
    date: "2026-02-01",
    dateLabel: "1 lutego 2026",
    title: "Zapisy na obóz letni wystartowały. Sprawdź szczegóły.",
    body: "O szczegóły zapytaj instruktora po treningu albo napisz do nas mailowo.",
  },
];
