"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

/**
 * Rozróżnia przyczyny nieudanego logowania.
 *
 * Wcześniej każdy błąd - także brak internetu i uśpiona baza - był pokazywany
 * jako „Nieprawidłowy email lub hasło", więc redaktor szukał literówki
 * w haśle, którego nikt nie zmieniał.
 */
function opiszBladLogowania(e: { message?: string; status?: number }): string {
  const s = (e.message ?? "").toLowerCase();
  if (s.includes("failed to fetch") || s.includes("networkerror") || s.includes("fetch")) {
    return "Nie udało się połączyć ze stroną. Sprawdź internet i spróbuj za chwilę - hasło jest w porządku.";
  }
  if (e.status === 429 || s.includes("rate limit") || s.includes("too many")) {
    return "Za dużo prób logowania. Odczekaj kilka minut i spróbuj jeszcze raz.";
  }
  if (s.includes("email not confirmed")) {
    return "To konto nie zostało jeszcze potwierdzone. Napisz do osoby, która je zakładała.";
  }
  return "Nieprawidłowy e-mail lub hasło. Sprawdź, czy nie jest włączony Caps Lock.";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Tryb odzyskiwania hasła - osobny widok w tym samym oknie.
  const [trybResetu, setTrybResetu] = useState(false);
  const [wyslano, setWyslano] = useState(false);

  const powod = params.get("powod");
  const wroc = params.get("wroc");

  // Jesli sesja juz istnieje - od razu do panelu.
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(wroc && wroc.startsWith("/admin") ? wroc : "/admin");
        router.refresh();
      }
    });
  }, [router, wroc]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(opiszBladLogowania(error));
        return;
      }
      // Wracamy tam, skąd użytkownik wypadł po wygaśnięciu sesji.
      router.replace(wroc && wroc.startsWith("/admin") ? wroc : "/admin");
      router.refresh();
    } catch (e) {
      setError(opiszBladLogowania(e as { message?: string }));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/nowe-haslo`,
      });
      if (error) {
        setError(opiszBladLogowania(error));
        return;
      }
      // Komunikat celowo nie zdradza, czy konto istnieje - to standard
      // bezpieczeństwa, żeby nie dało się zgadywać adresów administratorów.
      setWyslano(true);
    } catch (e) {
      setError(opiszBladLogowania(e as { message?: string }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-slate-100 flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold select-none">
              拳
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {trybResetu ? "Nie pamiętam hasła" : "Panel strony"}
              </h1>
              <p className="text-sm text-slate-500">Shorinji Kempo Kraków</p>
            </div>
          </div>

          {powod === "wygaslo" && !trybResetu && (
            <p className="mb-5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
              Twoje logowanie wygasło, dlatego wróciliśmy tu z powrotem. Zaloguj
              się jeszcze raz - wrócisz dokładnie tam, gdzie byłeś.
            </p>
          )}

          {trybResetu ? (
            wyslano ? (
              <div className="space-y-4">
                <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-3">
                  Jeśli konto o adresie <strong>{email}</strong> istnieje, wysłaliśmy
                  na nie wiadomość z odnośnikiem do ustawienia nowego hasła.
                  Sprawdź też folder ze spamem.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setTrybResetu(false);
                    setWyslano(false);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  ← Wróć do logowania
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-5">
                <p className="text-sm text-slate-600">
                  Podaj adres e-mail, którym się logujesz. Wyślemy na niego
                  odnośnik do ustawienia nowego hasła.
                </p>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Adres e-mail
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    placeholder="twoj@email.pl"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 transition-colors"
                >
                  {loading ? "Wysyłanie..." : "Wyślij odnośnik"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTrybResetu(false);
                    setError(null);
                  }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  ← Wróć do logowania
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Adres e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="twoj@email.pl"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Hasło
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 transition-colors"
              >
                {loading ? "Logowanie..." : "Zaloguj się"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTrybResetu(true);
                  setError(null);
                }}
                className="w-full text-sm text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
              >
                Nie pamiętam hasła
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link href="/" className="hover:text-slate-700 transition-colors">
            ← Wróć na stronę klubu
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  // useSearchParams wymaga granicy Suspense przy prerenderowaniu.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
