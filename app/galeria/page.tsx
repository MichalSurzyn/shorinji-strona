import type { Metadata } from "next";
import { getGalleryFolders } from "../../actions/galleryActions";
import GalleryClient from "./_components/GalleryClient";
import { PageHeader } from "@/components/PageContent";

export const metadata: Metadata = {
  title: "Galeria",
  description:
    "Zdjęcia z treningów, pokazów i seminariów krakowskiego dōjō Shorinji Kempo.",
  alternates: { canonical: "/galeria" },
};

// Ta podstrona może pobierać dane od razu na serwerze!
export default async function GaleriaPage() {
  const folders = await getGalleryFolders();

  return (
    // page-shell = calc(--nav-h + 2.5rem), ta sama zmienna co Navbar aktualizuje
    // na żywo -> pasek zakładek nigdy nie chowa się pod menu (bez sztywnego pt-40).
    <div className="page-shell min-h-screen bg-[#111111] pb-20">

      {/* Główna zawartość - Przekazujemy foldery do naszego nowego komponentu */}
      <div className="container-site">
        {/* Nagłówek z bazy (Strony → Galeria). Renderowany po stronie serwera,
            poza komponentem klienckim, żeby tekst był w HTML od razu -
            także dla wyszukiwarek i przy wyłączonym JavaScripcie. */}
        <div className="border-b border-neutral-800 pb-6 mb-10">
          <PageHeader slug="galeria" className="" />
        </div>
        {folders.length > 0 ? (
          <GalleryClient folders={folders} />
        ) : (
          <div className="text-center text-red-500 py-20">
            Nie znaleziono folderów w chmurze lub wystąpił błąd kluczy API. Upewnij się, że masz folder &bdquo;Galeria&rdquo; z podfolderami na Cloudinary.
          </div>
        )}
      </div>

    </div>
  );
}
