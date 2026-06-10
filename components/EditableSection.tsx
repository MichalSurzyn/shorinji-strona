import NewsBlocks from "@/components/NewsBlocks";
import { getPageBlocks } from "@/lib/pageOverrides";

/**
 * Edytowalny fragment strony statycznej.
 * Jeśli w panelu zapisano nadpisanie - renderuje bloki z bazy,
 * w przeciwnym razie pokazuje dotychczasową treść z kodu (fallback).
 */
export default async function EditableSection({
  slug,
  fallback,
}: {
  slug: string;
  fallback: React.ReactNode;
}) {
  const blocks = await getPageBlocks(slug);
  if (!blocks) return <>{fallback}</>;
  return <NewsBlocks blocks={blocks} />;
}
