"use client";

import { useState } from "react";
import {
  deleteContactMessage,
  markContactMessageRead,
  type ContactMessageRow,
} from "@/actions/contactActions";

const SOURCE_LABELS: Record<string, string> = {
  kontakt: "Kontakt",
  "zajecia-dorosli": "Zajęcia – dorośli",
  "zajecia-dzieci": "Zajęcia – dzieci",
};

/** Skrzynka wiadomości z formularza kontaktowego. */
export default function MessagesManager({ initial }: { initial: ContactMessageRow[] }) {
  const [messages, setMessages] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleRead(m: ContactMessageRow) {
    setBusyId(m.id);
    const res = await markContactMessageRead(m.id, !m.read);
    setBusyId(null);
    if (res.ok) {
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, read: !m.read } : x))
      );
    }
  }

  async function remove(m: ContactMessageRow) {
    if (!confirm(`Usunąć wiadomość od ${m.name}?`)) return;
    setBusyId(m.id);
    const res = await deleteContactMessage(m.id);
    setBusyId(null);
    if (res.ok) setMessages((prev) => prev.filter((x) => x.id !== m.id));
  }

  if (messages.length === 0) {
    return (
      <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-xl p-8 text-center">
        Brak wiadomości. Formularz kontaktowy jest na stronach zajęć i na podstronie Kontakt.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`bg-white rounded-xl border p-4 ${
            m.read ? "border-slate-200 opacity-70" : "border-indigo-300 shadow-sm"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {!m.read && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" title="Nieprzeczytana" />
              )}
              <span className="font-semibold truncate">{m.name}</span>
              <a
                href={`mailto:${m.email}`}
                className="text-sm text-indigo-600 hover:underline truncate"
              >
                {m.email}
              </a>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {m.source && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                  {SOURCE_LABELS[m.source] ?? m.source}
                </span>
              )}
              <span>{new Date(m.created_at).toLocaleString("pl-PL")}</span>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{m.message}</p>
          <div className="mt-3 flex gap-2 justify-end">
            <button
              onClick={() => toggleRead(m)}
              disabled={busyId === m.id}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {m.read ? "Oznacz jako nieprzeczytaną" : "Oznacz jako przeczytaną"}
            </button>
            <button
              onClick={() => remove(m)}
              disabled={busyId === m.id}
              className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Usuń
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
