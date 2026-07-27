import { clThumb, clUrl } from "@/lib/cloudinary";
import type { NewsBlock } from "@/lib/newsTypes";

/**
 * Wspólny renderer bloków treści (ciemny motyw strony) - używany przez
 * aktualności, strony serwisu i podstrony tematyczne.
 * Inline: **pogrubienie**, *kursywa*, ==żółte wyróżnienie==, [link](adres).
 */
export function InlineText({ text }: { text: string }) {
  const parts = text
    .split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|==[^=]+==|\[[^\]]+\]\([^)\s]+\))/g)
    .filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return (
            <strong key={i} className="font-semibold text-white">
              {p.slice(2, -2)}
            </strong>
          );
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
          return (
            <em key={i} className="italic">
              {p.slice(1, -1)}
            </em>
          );
        if (p.startsWith("==") && p.endsWith("=="))
          return (
            <span key={i} className="text-yellow-500">
              {p.slice(2, -2)}
            </span>
          );
        const m = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (m) {
          const external = /^https?:\/\//.test(m[2]);
          return (
            <a
              key={i}
              href={m[2]}
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="text-yellow-500 hover:text-yellow-400 underline-offset-4 hover:underline transition-colors"
            >
              {m[1]}
            </a>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/** Bezpieczna kotwica (anchor) z polskiego tekstu - do spisu treści. */
export function slugifyAnchor(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) =>
      ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" })[c] ?? c
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Renderuje pojedynczy blok treści. */
export function BlockRenderer({ block }: { block: NewsBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <div id={slugifyAnchor(block.text)} className="pt-6 first:pt-0 scroll-mt-32">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-wide">
              <InlineText text={block.text} />
            </h2>
            <div className="h-px flex-1 bg-yellow-500/30 hidden md:block" />
          </div>
        </div>
      );
    case "subheading":
      return (
        <h3 className="pt-3 text-lg md:text-xl font-semibold tracking-wide text-yellow-500/90">
          <InlineText text={block.text} />
        </h3>
      );
    case "paragraph":
      return (
        <p>
          <InlineText text={block.text} />
        </p>
      );
    case "callout":
      return (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 px-6 py-5 text-neutral-200 backdrop-blur-sm">
          <InlineText text={block.text} />
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-yellow-500/60 pl-5 italic text-neutral-200">
          <InlineText text={block.text} />
        </blockquote>
      );
    case "list":
      return (
        <ul className="space-y-3 pl-1">
          {block.items.map((item, j) => (
            <li key={j} className="flex gap-3">
              <span className="text-yellow-500 mt-1 select-none">▸</span>
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "ordered":
      return (
        <ol className="space-y-3 pl-1">
          {block.items.map((item, j) => (
            <li key={j} className="flex gap-3">
              <span className="text-yellow-500 font-semibold select-none min-w-[1.5rem]">
                {j + 1}.
              </span>
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "image": {
      const portrait = block.variant === "portrait";
      return (
        <figure className={`pt-2 ${portrait ? "max-w-md" : ""}`}>
          <div className="rounded-2xl overflow-hidden border border-neutral-700 shadow-2xl bg-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={clUrl(block.publicId, portrait ? 900 : 1400)}
              alt={block.caption ?? ""}
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
          {block.caption && (
            <figcaption className="text-sm text-neutral-500 mt-3 text-center">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "gallery":
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {block.publicIds.map((pid) => (
            <a
              key={pid}
              href={clUrl(pid, 2000)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl overflow-hidden border border-neutral-700 hover:border-yellow-500 transition-colors aspect-square bg-neutral-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={clThumb(pid, 600)}
                alt=""
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      );
    case "table": {
      const [h1, h2] = block.headers ?? ["Rodzaj opłaty", "Kwota"];
      return (
        <div className="rounded-xl border border-yellow-500/60 overflow-hidden bg-transparent backdrop-blur-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-yellow-500/10 border-b border-yellow-500/40">
                <th className="px-5 py-3 text-yellow-500 text-xs md:text-sm uppercase tracking-[0.12em] font-semibold">
                  {h1}
                </th>
                <th className="px-5 py-3 text-yellow-500 text-xs md:text-sm uppercase tracking-[0.12em] font-semibold text-right whitespace-nowrap">
                  {h2}
                </th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors hover:bg-yellow-500/5 ${
                    idx !== block.rows.length - 1
                      ? "border-b border-yellow-500/15"
                      : ""
                  }`}
                >
                  <td className="px-5 py-3 text-neutral-200 text-base">
                    <span>
                      <InlineText text={row.label} />
                    </span>
                    {row.note && (
                      <span className="ml-2 text-xs text-neutral-500 italic">
                        ({row.note})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-white font-medium whitespace-nowrap text-base">
                    {row.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "links":
      return (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {block.items.map((v) => (
            <li key={v.url + v.label}>
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-lg border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-500 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  <span className="text-white text-sm font-medium group-hover:text-yellow-100 transition-colors">
                    {v.label}
                  </span>
                </div>
                {v.note && (
                  <div className="mt-1 text-xs text-neutral-500 italic">
                    {v.note}
                  </div>
                )}
              </a>
            </li>
          ))}
        </ul>
      );
    case "video": {
      const id = youtubeId(block.url);
      if (!id) return null;
      const fourThree = block.aspect === "4:3";
      return (
        <figure className="pt-2">
          <div
            className={`${fourThree ? "aspect-[4/3]" : "aspect-video"} bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-700 shadow-2xl relative`}
          >
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${id}`}
              title={block.caption ?? "Film YouTube"}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          {block.caption && (
            <figcaption className="text-sm text-neutral-500 mt-3 text-center">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "download":
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-xl border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors p-4 max-w-xl"
        >
          {block.imageId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clThumb(block.imageId, 200)}
              alt=""
              className="w-20 h-20 object-cover rounded-lg border border-neutral-700 flex-shrink-0"
              loading="lazy"
            />
          ) : (
            <span className="w-20 h-20 rounded-lg border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-white font-semibold group-hover:text-yellow-100 transition-colors">
              {block.label}
            </span>
            {block.note && (
              <span className="block mt-0.5 text-sm text-neutral-500">{block.note}</span>
            )}
            <span className="mt-1 inline-flex items-center gap-1 text-xs uppercase tracking-wider text-yellow-500">
              Pobierz →
            </span>
          </span>
        </a>
      );
    case "person":
      return <PersonCard block={block} />;
    default:
      return null;
  }
}

/** Wyciąga ID filmu z adresu YouTube (watch / youtu.be / embed / shorts) albo z samego ID. */
export function youtubeId(url: string): string | null {
  const trimmed = url.trim();
  if (/^[\w-]{6,}$/.test(trimmed) && !trimmed.includes("/")) return trimmed;
  const m = trimmed.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/
  );
  return m ? m[1] : null;
}

/** Karta osoby - w stylu karty instruktora z podstron zajęć. */
function PersonCard({ block }: { block: Extract<NewsBlock, { type: "person" }> }) {
  return (
    <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 backdrop-blur-sm overflow-hidden flex flex-col h-full">
      {block.imageId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clUrl(block.imageId, 700)}
          alt={block.name}
          className="w-full aspect-[5/6] object-cover"
          loading="lazy"
        />
      )}
      <div className="p-6 flex-1 flex flex-col">
        {block.role && (
          <p className="text-yellow-500 text-xs uppercase tracking-[0.14em] font-semibold mb-1">
            {block.role}
          </p>
        )}
        <h3 className="text-2xl font-bold text-white tracking-wide">{block.name}</h3>
        {block.subtitle && (
          <p className="text-sm text-neutral-400 mt-1 italic">{block.subtitle}</p>
        )}
        {block.facts.length > 0 && (
          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {block.facts.map((f, i) => (
              <div key={i}>
                <dt className="text-neutral-500 uppercase text-xs tracking-wider">{f.label}</dt>
                <dd className="text-white font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {block.note && (
          <div className="mt-5 pt-5 border-t border-yellow-500/20 text-sm text-neutral-300">
            <InlineText text={block.note} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsBlocks({ blocks }: { blocks: NewsBlock[] }) {
  // Kolejne bloki "person" grupujemy w siatkę - karty stają obok siebie.
  const groups: (NewsBlock | NewsBlock[])[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.type === "person") {
      if (Array.isArray(last)) last.push(block);
      else groups.push([block]);
    } else {
      groups.push(block);
    }
  }

  return (
    <div className="space-y-6 text-neutral-300 text-lg leading-relaxed">
      {groups.map((g, i) =>
        Array.isArray(g) ? (
          <div
            key={i}
            className={`grid grid-cols-1 gap-6 pt-2 ${
              g.length === 1 ? "md:grid-cols-[minmax(0,32rem)]" : "md:grid-cols-2"
            }`}
          >
            {g.map((b, j) => (
              <BlockRenderer key={j} block={b} />
            ))}
          </div>
        ) : (
          <BlockRenderer key={i} block={g} />
        )
      )}
    </div>
  );
}
