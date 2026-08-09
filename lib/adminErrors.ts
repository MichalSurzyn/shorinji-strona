/**
 * Zamiana błędu technicznego na zdanie zrozumiałe dla redaktora.
 *
 * Zasada trzech części: co się nie udało, dlaczego (tylko jeśli to zmienia
 * to, co użytkownik ma teraz zrobić) i jaki jest następny krok. Bez kodów
 * błędów, bez nazw tabel, bez angielskiego.
 *
 * Panel obsługuje osoba nietechniczna, która edytuje raz na kilka tygodni.
 * Komunikat "duplicate key value violates unique constraint" nie mówi jej
 * nic poza tym, że coś jest zepsute - a najczęściej zepsute nie jest, tylko
 * adres strony jest już zajęty.
 */

/** Zdanie domykające każdy komunikat o nieudanym zapisie. */
const TEKST_BEZPIECZNY = "Twój tekst jest nadal w tym oknie, nic nie przepadło.";

function tekstBledu(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e ?? "");
}

/**
 * Opis błędu dla redaktora.
 *
 * @param e       Błąd: wyjątek, komunikat z server action albo cokolwiek innego.
 * @param czynnosc Co użytkownik próbował zrobić, w bezokoliczniku i dopełniaczu,
 *                 np. "zapisać zmian", "usunąć zdjęcia". Wchodzi w zdanie
 *                 „Nie udało się {czynnosc}."
 */
export function opiszBlad(e: unknown, czynnosc = "zapisać zmian"): string {
  const raw = tekstBledu(e);
  const s = raw.toLowerCase();

  // Wygasła sesja. Najczęstszy przypadek przy rzadkiej edycji - użytkownik
  // otwiera panel, pisze pół godziny, klika Zapisz i dopiero wtedy się okazuje.
  if (
    s.includes("brak autoryzacji") ||
    s.includes("jwt") ||
    s.includes("not authenticated") ||
    s.includes("invalid claim") ||
    s.includes("session")
  ) {
    return (
      `Nie udało się ${czynnosc}, bo wygasło logowanie. ${TEKST_BEZPIECZNY} ` +
      "Otwórz panel w nowej karcie, zaloguj się jeszcze raz i wróć tutaj kliknąć Zapisz."
    );
  }

  // Brak sieci albo uśpiona baza (darmowy plan Supabase usypia projekt).
  if (
    s.includes("failed to fetch") ||
    s.includes("networkerror") ||
    s.includes("fetch failed") ||
    s.includes("econnrefused") ||
    s.includes("timeout") ||
    s.includes("aborted")
  ) {
    return (
      `Nie udało się ${czynnosc} - brak połączenia z serwerem. ${TEKST_BEZPIECZNY} ` +
      "Sprawdź internet i spróbuj za chwilę."
    );
  }

  // 23505: naruszenie unikalności. W tym panelu zawsze chodzi o adres strony.
  if (s.includes("23505") || s.includes("duplicate key") || s.includes("już istnieje")) {
    return "Taki adres strony jest już zajęty przez inną stronę. Zmień adres i zapisz jeszcze raz.";
  }

  // Brak tabeli / kolumny - baza nie została skonfigurowana do końca.
  if (s.includes("schema cache") || s.includes("does not exist") || s.includes("42p01")) {
    return (
      `Nie udało się ${czynnosc}, bo brakuje elementu w bazie danych. ${TEKST_BEZPIECZNY} ` +
      "To sprawa dla osoby technicznej - przekaż jej tę wiadomość."
    );
  }

  // RLS: uprawnienia. Dla redaktora to zawsze znaczy „nie masz dostępu".
  if (s.includes("row-level security") || s.includes("42501") || s.includes("permission denied")) {
    return (
      `Nie udało się ${czynnosc} - Twoje konto nie ma uprawnień do tej operacji. ` +
      "Skontaktuj się z osobą, która zakładała Ci dostęp do panelu."
    );
  }

  // Brak konfiguracji po stronie serwera.
  if (s.includes("brak konfiguracji") || s.includes("supabase_service_role_key")) {
    return (
      `Nie udało się ${czynnosc}, bo strona nie jest połączona z bazą danych. ` +
      "To sprawa dla osoby technicznej - przekaż jej tę wiadomość."
    );
  }

  // Nieznany błąd. Nie pokazujemy treści technicznej, ale zostawiamy ją
  // w konsoli przeglądarki, żeby dało się zdiagnozować przez telefon.
  if (raw) console.warn("[panel] nieobsłużony błąd:", raw);
  return (
    `Nie udało się ${czynnosc}. ${TEKST_BEZPIECZNY} ` +
    "Spróbuj jeszcze raz za chwilę. Jeśli błąd się powtórzy, przekaż to osobie technicznej."
  );
}
