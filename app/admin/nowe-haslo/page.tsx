"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

/** Minimalna długość hasła wymagana przez Supabase Auth. */
const MIN_ZNAKOW = 6;

/**
 * Ustawienie nowego hasła po kliknięciu odnośnika z wiadomości.
 *
 * Leży poza grupą (panel), więc nie chroni jej strażnik sesji - inaczej
 * osoba, która zapomniała hasła, zostałaby odesłana z powrotem na logowanie
 * i pętla by się zamknęła.
 *
 * Supabase po wejściu z odnośnika sam zakłada sesję odzyskiwania, więc
 * wystarczy tu sprawdzić, czy istnieje, i wywołać updateUser.
 */
export default function NoweHasloPage() {
  const router = useRouter();
  const [haslo, setHaslo] = useState("");
  const [powtorz, setPowtorz] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [gotowe, setGotowe] = useState(false);
  const [maSesje, setMaSesje] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    // Odnośnik z wiadomości zawiera token w adresie; klient Supabase
    // przetwarza go i zakłada sesję, co bywa opóźnione o jeden cykl.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setMaSesje(!!session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMaSesje((obecne) => obecne ?? !!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (haslo.length < MIN_ZNAKOW) {
      setError(`Hasło musi mieć co najmniej ${MIN_ZNAKOW} znaków.`);
      return;
    }
    if (haslo !== powtorz) {
      setError("Oba hasła muszą być takie same. Sprawdź, czy nie ma literówki.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.updateUser({ password: haslo });
      if (error) {
        setError(
          error.message.toLowerCase().includes("same")
            ? "To jest Twoje obecne hasło. Wpisz inne."
            : "Nie udało się ustawić hasła. Odnośnik mógł stracić ważność - poproś o nowy."
        );
        return;
      }
      setGotowe(true);
      setTimeout(() => {
        router.replace("/admin");
        router.refresh();
      }, 2000);
    } catch {
      setError("Nie udało się połączyć ze stroną. Sprawdź internet i spróbuj jeszcze raz.");
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
              <h1 className="text-xl font-bold text-slate-900">Nowe hasło</h1>
              <p className="text-sm text-slate-500">Shorinji Kempo Kraków</p>
            </div>
          </div>

          {gotowe ? (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-3">
              Hasło zostało zmienione. Za chwilę przeniesiemy Cię do panelu.
            </p>
          ) : maSesje === false ? (
            <div className="space-y-4">
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-3">
                Ten odnośnik stracił ważność albo został już użyty. Odnośniki do
                zmiany hasła działają przez godzinę.
              </p>
              <Link
                href="/admin/login"
                className="block text-center w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Poproś o nowy odnośnik
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-slate-600">
                Wymyśl nowe hasło. Zapisz je w bezpiecznym miejscu - będzie
                potrzebne przy każdym logowaniu do panelu.
              </p>
              <div>
                <label htmlFor="haslo" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nowe hasło
                </label>
                <input
                  id="haslo"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={haslo}
                  onChange={(e) => setHaslo(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Co najmniej {MIN_ZNAKOW} znaków.
                </p>
              </div>
              <div>
                <label htmlFor="powtorz" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Powtórz nowe hasło
                </label>
                <input
                  id="powtorz"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={powtorz}
                  onChange={(e) => setPowtorz(e.target.value)}
                  className={inputCls}
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
                {loading ? "Zapisywanie..." : "Ustaw nowe hasło"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
