import FooterEditor from "@/components/admin/FooterEditor";
import { getFooterData } from "@/lib/footerData";

export default async function AdminFooterPage() {
  const data = await getFooterData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stopka</h1>
        <p className="text-slate-500 mt-1 max-w-2xl">
          Treści widoczne na dole każdej strony: opis, linki społecznościowe,
          pliki do pobrania, dokumenty i dane kontaktowe.
        </p>
      </div>
      <FooterEditor initialData={data} />
    </div>
  );
}
