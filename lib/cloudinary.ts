/** Helpery URL Cloudinary - bezpieczne także po stronie klienta. */
export const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.replace(/"/g, "") || "dyn3apjzb";

/** Pełnowymiarowe zdjęcie (ograniczone szerokością, auto format/jakość). */
export function clUrl(publicId: string, width = 1400): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width},c_limit/${publicId}`;
}

/** Kwadratowa miniatura (kadrowana) do siatek i galerii. */
export function clThumb(publicId: string, size = 400): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${size},h_${size},c_fill,g_auto/${publicId}`;
}
