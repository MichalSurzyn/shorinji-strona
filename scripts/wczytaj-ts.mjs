/**
 * wczytaj-ts.mjs — pozwala skryptom .mjs importować pliki .ts z tego repo.
 *
 * PO CO
 * -----
 * Prefille nagłówków (`lib/editablePages.ts`), treść bazowa podstron
 * (`data/articles/*.ts`) i typy menu (`lib/navTree.ts`) żyją w TypeScripcie
 * i nie mają odpowiednika w JSON-ie. Skrypty migracyjne muszą je czytać
 * DOKŁADNIE, a nie przez wyrażenia regularne: chodzi o pełne teksty wstępów
 * z apostrofami i myślnikami w środku, gdzie regexp myli się cicho, a cicha
 * pomyłka w tytule wychodzi dopiero po `drop table` w etapie 8.
 *
 * JAK
 * ---
 * Node od 22.18 / 23.6 sam usuwa typy z plików .ts. Brakuje mu wyłącznie dwóch
 * konwencji tego projektu: importu bez rozszerzenia (`./site`) i aliasu `@/`
 * z `tsconfig.json`. Hak `resolve` dokłada jedno i drugie — nic więcej.
 *
 * OGRANICZENIE, o którym trzeba wiedzieć: usuwanie typów działa tylko dla
 * składni „wymazywalnej". `enum`, `namespace` i pola konstruktora z modyfikatorem
 * dostępu wysypią import. W tym repo takiej składni nie ma i nie powinno być.
 */

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve as sciezkaBezwzgledna } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const [duza, mala] = process.versions.node.split(".").map(Number);
if (duza < 22 || (duza === 22 && mala < 18)) {
  console.error(
    `ODMOWA: Node ${process.versions.node} nie wczyta plików .ts bez dodatkowych narzędzi.\n` +
      "Potrzebny Node 22.18+ albo 23.6+ (samodzielne usuwanie typów).",
  );
  process.exit(1);
}

registerHooks({
  resolve(specyfikator, kontekst, dalej) {
    let cel = null;
    if (specyfikator.startsWith("@/")) {
      cel = sciezkaBezwzgledna(ROOT, specyfikator.slice(2));
    } else if (specyfikator.startsWith(".") && kontekst.parentURL?.startsWith("file:")) {
      cel = sciezkaBezwzgledna(dirname(fileURLToPath(kontekst.parentURL)), specyfikator);
    }
    if (cel) {
      for (const koncowka of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(cel + koncowka)) {
          return { url: pathToFileURL(cel + koncowka).href, shortCircuit: true };
        }
      }
    }
    return dalej(specyfikator, kontekst);
  },
});

/** Import pliku z repo po ścieżce względnej wobec katalogu projektu. */
export const zKodu = (wzgledna) => import(pathToFileURL(join(ROOT, wzgledna)).href);

export { ROOT };
