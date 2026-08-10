"use client";

import { useCallback } from "react";
import TrashSection from "@/components/admin/TrashSection";
import {
  listTrashedArticles,
  purgeNewsArticle,
  restoreNewsArticle,
} from "@/actions/newsActions";

/**
 * Kosz aktualności - cienka nakładka na wspólny komponent.
 *
 * Osobny plik, bo akcje serwerowe trzeba przekazać z komponentu klienckiego,
 * a strona listy jest serwerowa i nie może przekazywać funkcji jako propów.
 */
export default function KoszAktualnosci() {
  const pobierz = useCallback(async () => {
    const res = await listTrashedArticles();
    return res.ok
      ? ({ ok: true as const, items: res.articles as never })
      : ({ ok: false as const, error: res.error });
  }, []);

  return (
    <TrashSection
      tytul="Kosz"
      pobierz={pobierz}
      przywroc={restoreNewsArticle}
      usunNaStale={purgeNewsArticle}
    />
  );
}
