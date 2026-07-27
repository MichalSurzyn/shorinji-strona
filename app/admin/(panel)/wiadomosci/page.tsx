import MessagesManager from "@/components/admin/MessagesManager";
import { listContactMessages } from "@/actions/contactActions";

export const dynamic = "force-dynamic";

export default async function AdminWiadomosciPage() {
  const result = await listContactMessages();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wiadomości</h1>
        <p className="text-sm text-slate-500 mt-1">
          Wiadomości wysłane przez formularz kontaktowy na stronie.
        </p>
      </div>

      {result.ok ? (
        <MessagesManager initial={result.messages} />
      ) : (
        <div className="rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-4 py-3 text-sm space-y-1">
          <p className="font-semibold">Nie udało się pobrać wiadomości.</p>
          <p>{result.error}</p>
          <p>
            Jeśli to pierwsze uruchomienie: wklej zawartość pliku{" "}
            <code className="bg-amber-100 px-1 rounded">supabase/setup.sql</code>{" "}
            w Supabase → SQL Editor i uruchom.
          </p>
        </div>
      )}
    </div>
  );
}
