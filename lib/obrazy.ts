/** Powyżej tej krawędzi zdjęcie jest zmniejszane przed wysyłką. */
const MAX_KRAWEDZ = 2400;
/** Poniżej tego rozmiaru nie ma czego zmniejszać. */
const PROG_ZMNIEJSZANIA = 1_500_000;

/**
 * Zmniejsza zdjęcie w przeglądarce przed wysyłką do Cloudinary.
 *
 * Zdjęcia prosto z telefonu ważą po kilka megabajtów, a wysyłka idzie
 * bezpośrednio z urządzenia redaktora - na internecie komórkowym potrafi
 * trwać minutami i paść w połowie.
 *
 * Rysowanie na kanwie przy okazji zdejmuje metadane, w tym współrzędne GPS
 * miejsca wykonania zdjęcia. Cloudinary czyści metadane przy transformacji,
 * ale ORYGINAŁ zostaje publicznie osiągalny pod adresem bez transformacji.
 *
 * Przy niepowodzeniu zwracamy oryginał - lepiej wysłać duży plik niż nie
 * wysłać nic.
 */
export async function zmniejszZdjecie(plik: File): Promise<File> {
  if (!plik.type.startsWith("image/") || plik.size < PROG_ZMNIEJSZANIA) return plik;
  try {
    const bitmapa = await createImageBitmap(plik);
    const skala = Math.min(1, MAX_KRAWEDZ / Math.max(bitmapa.width, bitmapa.height));
    if (skala >= 1) {
      bitmapa.close();
      return plik;
    }
    const w = Math.round(bitmapa.width * skala);
    const h = Math.round(bitmapa.height * skala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return plik;
    ctx.drawImage(bitmapa, 0, 0, w, h);
    bitmapa.close();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.9)
    );
    if (!blob || blob.size >= plik.size) return plik;
    return new File([blob], plik.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return plik;
  }
}
