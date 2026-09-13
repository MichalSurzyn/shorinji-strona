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

/**
 * Bez tego strona jest prerenderowana raz, na buildzie, i zostaje taka na zawsze:
 * Netlify trzymał ją w trwałym cache z TTL ~358 dni (zmierzone: `age: 39955`,
 * `"Netlify Durable"; ttl=30919180`). Redaktor wgrywał zdjęcia, panel pisał
 * „Są już widoczne na stronie", a /galeria pokazywała stan z dnia wdrożenia.
 * Lista albumów i zdjęć siedzi w Cloudinary, nagłówek w bazie - jedno i drugie
 * zmienia się bez wdrożenia, więc strona musi się odświeżać jak reszta serwisu.
 */
export const revalidate = 300;

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
