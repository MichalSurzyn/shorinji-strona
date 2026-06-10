"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Jesli sesja juz istnieje - od razu do panelu.
  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/admin");
        router.refresh();
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("Nieprawidłowy email lub hasło.");
      setLoading(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[90] bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold select-none">
              拳
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Panel admina</h1>
              <p className="text-sm text-slate-500">Shorinji Kempo Kraków</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="twoj@email.pl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Hasło
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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
          </form>
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          <a href="/" className="hover:text-slate-700 transition-colors">
            ← Wróć na stronę
          </a>
        </p>
      </div>
    </div>
  );
}
