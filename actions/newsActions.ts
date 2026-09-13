"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { oproznijStaryKosz, zapiszWersje } from "@/lib/versions";
import type { NewsBlock } from "@/lib/newsTypes";

/**
 * Aktualności — zapis. Wszystko kluczem SERWISOWYM, po `requireUser()`.
 *
 * DLACZEGO NIE KLIENTEM SESYJNYM (zgłoszenie E3 z trzeciej rundy)
 * ----------------------------------------------------------------
 * `public.articles` ma włączone RLS i ZERO polityk — sprawdzone zapytaniem
 * `select * from pg_policies where schemaname='public'` (2026-09-09: zero
 * wierszy dla wszystkich sześciu tabel). Klient sesyjny występuje w bazie jako
 * rola `authenticated`, więc podlega RLS i nie widzi ani jednego wiersza.
 *
 * Skutki były RÓŻNE dla różnych operacji i to jest cała trudność tego błędu:
 *   INSERT  → 42501, redaktor widzi „Twoje konto nie ma uprawnień” (to zgłosił),
 *   UPDATE  → trafia w ZERO wierszy, PostgREST oddaje 204 BEZ błędu,
 *   DELETE  → to samo.
 * Czyli zapis zmian, kosz, przywracanie i kasowanie na stałe kończyły się
 * komunikatem „Zapisano. Zmiany są już widoczne na stronie." i nie robiły nic.
 * Zmierzone end-to-end przez przeglądarkę na poligonie: tytuł przed zapisem
 * i po zapisie identyczny, panel zameldował sukces.
 *
 * Dlatego przepięte są WSZYSTKIE pięć funkcji naraz, a nie sama ta, którą
 * redaktor umiał opisać. Zostawienie połowy dałoby stan najgorszy z możliwych:
 * kosz wyglądający na działający i niedziałający, bez żadnego komunikatu.
 *
 * Poprawką NIE jest dodanie polityki RLS. Rola `authenticated` ma GRANT-y na
 * wszystkich tabelach, a klucz anon leży w bundlu przeglądarki — polityka
 * `for all to authenticated using (true)` oddałaby szkice i kosz każdemu, kto
 * ma konto w tym projekcie Supabase. Bramką dostępu jest `requireUser()`
 * i tylko ono; kolejność „requireUser() PRZED pierwszym użyciem klienta”
 * obowiązuje w każdej funkcji tego pliku.
 */

export interface NewsInput {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  content: NewsBlock[];
  published: boolean;
  published_at: string;
}

/**
 * Klient albo wyjątek — ten sam wzorzec co `actions/pagesActions.ts`.
 *
 * Świadomie NIE `if (sb) { … }`: `getSupabaseAdmin()` memoizuje także `null`,
 * więc wariant warunkowy zamieniłby brak konfiguracji w kolejny cichy no-op,
 * czyli dokładnie w ten błąd, który ten plik naprawia.
 */
function klient() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Brak konfiguracji Supabase.");
  return sb;
}

const sciezkaWpisu = (slug: string) => `/aktualnosci/${slug}`;

function revalidateNews(...slugi: (string | null | undefined)[]) {
  revalidatePath("/");
  revalidatePath("/aktualnosci");
  for (const s of slugi) if (s) revalidatePath(sciezkaWpisu(s));
  // Mapa witryny ma własny wpis w cache i żaden z powyższych jej nie dotyka
  // (jej tagi to _N_T_/layout i _N_T_/sitemap.xml, nie _N_T_/aktualnosci).
  // Bez tego nowy artykuł nie trafiał do mapy, a skasowany w niej zostawał.
  revalidatePath("/sitemap.xml");
}

/**
 * Zero zmienionych wierszy to BŁĄD, nie sukces.
 *
 * `update`/`delete` bez `.select()` oddają 204 i nie da się odróżnić „zapisano”
 * od „nie trafiono w żaden wiersz”. Po przepięciu na klucz serwisowy RLS już
 * takiego stanu nie wywoła, ale wywoła go złe `id` albo druga karta, w której
 * ktoś właśnie przeniósł ten artykuł do kosza — a wtedy panel znów powiedziałby
 * „Zapisano”. Kosztowało to całą rundę checklisty, więc asercja zostaje na stałe.
 */
function czyTrafione(wiersze: unknown[] | null, czynnosc: string) {
  if (wiersze && wiersze.length > 0) return null;
  return `Nie udało się ${czynnosc} — tego artykułu już nie ma. Odśwież listę.`;
}

export async function createNewsArticle(input: NewsInput) {
  const { user } = await requireUser();
  const { data, error } = await klient()
    .from("articles")
    .insert({
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      cover_image: input.cover_image,
      content: input.content,
      published: input.published,
      published_at: input.published_at,
      updated_by: user.email ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidateNews(input.slug);
  return { ok: true as const, id: data.id as string };
}

export async function saveNewsArticle(id: string, input: NewsInput) {
  const { user } = await requireUser();
  const sb = klient();

  // Migawka stanu SPRZED nadpisania - to do niej wraca się z historii.
  const { data: poprzedni } = await sb.from("articles").select("*").eq("id", id).maybeSingle();
  if (poprzedni) await zapiszWersje("article", id, poprzedni, user.email);

  const starySlug = (poprzedni?.slug as string | undefined) ?? null;

  const { data, error } = await sb
    .from("articles")
    .update({
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      cover_image: input.cover_image,
      content: input.content,
      published: input.published,
      published_at: input.published_at,
      updated_at: new Date().toISOString(),
      updated_by: user.email ?? null,
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false as const, error: error.message };
  const pusto = czyTrafione(data, "zapisać artykułu");
  if (pusto) return { ok: false as const, error: pusto };

  if (starySlug && starySlug !== input.slug) {
    await przekierujWpis(starySlug, input.slug);
  }

  revalidateNews(input.slug, starySlug);
  return { ok: true as const };
}

/**
 * Przekierowanie spod starego adresu wpisu — druga połowa pary, której dotąd
 * nie było.
 *
 * `app/aktualnosci/[slug]/page.tsx` czyta `redirects` przy nieudanym odczycie
 * wpisu i komentarz w tym pliku zapowiada, że wiersz „robi akcja zapisu”.
 * Nie robiła go żadna — bo zapis w ogóle nie dochodził do bazy. Aktualności
 * stoją poza drzewem `pages`, więc trigger `pages_after_update` ich nie widzi
 * i 308 trzeba zapisać tutaj, ręcznie.
 *
 * Rozstrzygnięcie właściciela z etapu 0b: aktualności DOSTAJĄ przekierowania
 * przy zmianie sluga, bo to trwałe archiwum wpisów, a nie efemeryda.
 *
 * Zapis idzie PO udanym UPDATE. Odwrotna kolejność przy awarii zostawiłaby
 * przekierowanie prowadzące na adres, którego nie ma — ta sama zasada, co
 * przy zamianie rodzaju strony.
 */
async function przekierujWpis(starySlug: string, nowySlug: string) {
  const sb = klient();
  const stary = sciezkaWpisu(starySlug);
  const nowy = sciezkaWpisu(nowySlug);

  const { error } = await sb
    .from("redirects")
    .upsert({ old_path: stary, new_path: nowy, status: 308, source: "auto" }, { onConflict: "old_path" });
  if (error) {
    // Nieudane przekierowanie nie może wycofać zapisanej treści — redaktor
    // straciłby swoją pracę przez wiersz pomocniczy. Zostaje w logu serwera.
    console.warn("[aktualnosci] nie zapisano przekierowania:", error.message);
    return;
  }

  // Domknięcie łańcuchów: wpisy prowadzące na STARY adres mają odtąd prowadzić
  // wprost na nowy. Bez tego drugi z rzędu zmieniony slug daje 308 na 308,
  // a wyszukiwarki przestają za tym chodzić po kilku skokach.
  await sb.from("redirects").update({ new_path: nowy }).eq("new_path", stary).neq("old_path", nowy);

  // Adres, który właśnie stał się ŻYWY, nie może jednocześnie być źródłem
  // przekierowania — czytelnik trafiłby na wiersz mówiący, że ta strona jest
  // gdzie indziej. Odczyt strony wygrywa z `redirects`, więc to nie awaria,
  // tylko nieprawda w tabeli; kasujemy ją przy okazji.
  await sb.from("redirects").delete().eq("old_path", nowy);
}

/**
 * Przenosi artykuł do kosza.
 *
 * Nie kasujemy wiersza: przy kilku osobach z dostępem pomyłka jednej z nich
 * była dotąd nie do odwrócenia. Wiersz znika ze strony i z listy natychmiast,
 * ale wraca jednym kliknięciem przez 30 dni.
 */
export async function deleteNewsArticle(id: string) {
  const { user } = await requireUser();
  const sb = klient();
  const { data, error } = await sb
    .from("articles")
    .update({ deleted_at: new Date().toISOString(), updated_by: user.email ?? null })
    .eq("id", id)
    .select("id,slug");
  if (error) return { ok: false as const, error: error.message };
  const pusto = czyTrafione(data, "przenieść artykułu do kosza");
  if (pusto) return { ok: false as const, error: pusto };

  revalidateNews(data?.[0]?.slug as string | undefined);
  return { ok: true as const };
}

/** Przywraca artykuł z kosza. */
export async function restoreNewsArticle(id: string) {
  const { user } = await requireUser();
  const { data, error } = await klient()
    .from("articles")
    .update({ deleted_at: null, updated_by: user.email ?? null })
    .eq("id", id)
    .select("id,slug");
  if (error) return { ok: false as const, error: error.message };
  const pusto = czyTrafione(data, "przywrócić artykułu");
  if (pusto) return { ok: false as const, error: pusto };

  revalidateNews(data?.[0]?.slug as string | undefined);
  return { ok: true as const };
}

/** Kasuje artykuł z kosza NA STAŁE. Jedyna operacja bez odwrotu. */
export async function purgeNewsArticle(id: string) {
  await requireUser();
  const { data, error } = await klient()
    .from("articles")
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null) // bezpiecznik: tylko z kosza
    .select("id,slug");
  if (error) return { ok: false as const, error: error.message };
  const pusto = czyTrafione(data, "usunąć artykułu na stałe");
  if (pusto) return { ok: false as const, error: pusto };

  revalidateNews(data?.[0]?.slug as string | undefined);
  return { ok: true as const };
}

/** Zawartość kosza - do sekcji w panelu. */
export async function listTrashedArticles() {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };
  await oproznijStaryKosz("articles");
  const { data, error } = await sb
    .from("articles")
    .select("id,title,slug,deleted_at,updated_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, articles: data ?? [] };
}
