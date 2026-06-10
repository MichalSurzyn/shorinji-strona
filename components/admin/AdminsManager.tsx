"use client";

import { useState } from "react";
import {
  addAdmin,
  changeOwnPassword,
  listAdmins,
  removeAdmin,
  type AdminUser,
} from "@/actions/userActions";

export default function AdminsManager({
  initialAdmins,
  currentUserId,
}: {
  initialAdmins: AdminUser[];
  currentUserId: string;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    setAdmins(await listAdmins());
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await addAdmin(email.trim(), password, name.trim());
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `Dodano administratora ${email}.` });
      setEmail("");
      setName("");
      setPassword("");
      refresh();
    } else {
      setMsg({ ok: false, text: res.error });
    }
  }

  async function handleRemove(admin: AdminUser) {
    if (!confirm(`Usunąć konto ${admin.email}?`)) return;
    const res = await removeAdmin(admin.id);
    if (res.ok) refresh();
    else setMsg({ ok: false, text: res.error });
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await changeOwnPassword(newPass);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Hasło zmienione." });
      setNewPass("");
    } else {
      setMsg({ ok: false, text: res.error });
    }
  }

  return (
    <div className="space-y-6">
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

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {admins.length === 0 && (
          <p className="px-5 py-6 text-sm text-slate-400">
            Nie udało się pobrać listy kont (sprawdź konfigurację Supabase).
          </p>
        )}
        {admins.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">
                {a.name ?? a.email}
                {a.id === currentUserId && (
                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">
                    to Ty
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-400 truncate">
                {a.email}
                {a.lastSignInAt &&
                  ` · ostatnie logowanie ${new Date(a.lastSignInAt).toLocaleDateString("pl-PL")}`}
              </div>
            </div>
            {a.id !== currentUserId && (
              <button
                onClick={() => handleRemove(a)}
                className="shrink-0 rounded-lg border border-red-300 text-red-600 px-3.5 py-1.5 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Usuń
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
        >
          <h2 className="font-bold">Dodaj administratora</h2>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa (np. imię)"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Hasło (min. 8 znaków)"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition-colors"
          >
            Dodaj konto
          </button>
        </form>

        <form
          onSubmit={handlePassword}
          className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
        >
          <h2 className="font-bold">Zmień swoje hasło</h2>
          <input
            type="password"
            required
            minLength={8}
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Nowe hasło (min. 8 znaków)"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            disabled={busy}
            className="w-full rounded-lg border border-slate-300 hover:bg-slate-50 font-semibold py-2.5 text-sm transition-colors"
          >
            Zmień hasło
          </button>
        </form>
      </div>
    </div>
  );
}
