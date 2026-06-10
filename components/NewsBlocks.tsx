import { clThumb, clUrl } from "@/lib/cloudinary";
import type { NewsBlock } from "@/lib/newsTypes";

/**
 * Wspólny renderer bloków treści (ciemny motyw strony) - używany przez
 * aktualności, strony serwisu i podstrony tematyczne.
 * Inline: **pogrubienie**, ==żółte wyróżnienie==, [link](adres).
 */
export function InlineText({ text }: { text: string }) {
  const parts = text
    .split(/(\*\*[^*]+\*\*|==[^=]+==|\[[^\]]+\]\([^)\s]+\))/g)
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
    default:
      return null;
  }
}

export default function NewsBlocks({ blocks }: { blocks: NewsBlock[] }) {
  return (
    <div className="space-y-6 text-neutral-300 text-lg leading-relaxed">
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </div>
  );
}
