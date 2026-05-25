import { getGalleryFolders } from "../../actions/galleryActions";
import GalleryClient from "./_components/GalleryClient";

// Ta podstrona może pobierać dane od razu na serwerze!
export default async function GaleriaPage() {
  const folders = await getGalleryFolders();

  return (
    // Zastosowałem odpowiedni odstęp od góry (pt-40/pt-56), żeby pasek nie zasłaniał
    <div className="min-h-screen bg-[#111111] pt-40 pb-20">

      {/* Główna zawartość - Przekazujemy foldery do naszego nowego komponentu */}
      <div className="w-[80%] mx-auto">
        {folders.length > 0 ? (
          <GalleryClient folders={folders} />
        ) : (
          <div className="text-center text-red-500 py-20">
            Nie znaleziono folderów w chmurze lub wystąpił błąd kluczy API. Upewnij się, że masz folder "Galeria" z podfolderami na Cloudinary.
          </div>
        )}
      </div>

    </div>
  );
}
