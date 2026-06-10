import ImagesManager from "@/components/admin/ImagesManager";

export default function AdminImagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Zdjęcia</h1>
        <p className="text-slate-500 mt-1 max-w-2xl">
          Foldery „Galeria / …" to zakładki publicznej galerii - wgrane tam
          zdjęcia od razu pojawiają się na stronie. Foldery „Strona / …"
          zawierają zdjęcia podstron (galerie pod artykułami).
        </p>
      </div>
      <ImagesManager />
    </div>
  );
}
