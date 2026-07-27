"use client";

import { useState } from "react";
import { sendContactMessage } from "@/actions/contactActions";

/**
 * Formularz kontaktowy (ciemny motyw strony). Wiadomości trafiają do bazy
 * i są widoczne w panelu admina → Wiadomości.
 */
export default function ContactForm({
  source,
  className = "",
}: {
  /** Skąd wysłano (np. "zajecia-dorosli") - widoczne w panelu. */
  source?: string;
  className?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const res = await sendContactMessage({ name, email, message, source, website });
    setBusy(false);
    if (res.ok) {
      setResult({ ok: true, text: "Dziękujemy! Wiadomość została wysłana - odezwiemy się wkrótce." });
      setName("");
      setEmail("");
      setMessage("");
    } else {
      setResult({ ok: false, text: res.error });
    }
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors";

  return (
    <section className={className}>
      <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
        <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-wide">
          Napisz do nas
        </h2>
        <div className="h-px flex-1 bg-yellow-500/30 hidden md:block" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 backdrop-blur-sm p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">
              Imię i nazwisko
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              placeholder="Jan Kowalski"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">
              E-mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={200}
              placeholder="jan@przyklad.pl"
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-neutral-400 mb-1.5">
            Wiadomość
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            maxLength={4000}
            rows={5}
            placeholder="W czym możemy pomóc?"
            className={inputClass}
          />
        </label>

        {/* Honeypot - niewidoczne pole antyspamowe */}
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        {result && (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              result.ok
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "bg-red-500/10 text-red-400 border border-red-500/30"
            }`}
          >
            {result.text}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/60 bg-yellow-500/10 hover:bg-yellow-500/20 hover:border-yellow-500 disabled:opacity-60 transition-colors px-6 py-3 text-sm font-semibold text-white"
          >
            {busy ? "Wysyłanie..." : "Wyślij wiadomość"}
          </button>
        </div>
      </form>
    </section>
  );
}
