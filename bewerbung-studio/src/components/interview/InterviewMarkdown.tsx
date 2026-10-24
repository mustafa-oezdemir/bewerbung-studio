import { ImageDown, ImageIcon } from "lucide-react";
import { createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  localInterviewImagePattern,
  parseMarkdownBlocks,
  type MarkdownBlock,
  type MarkdownImage,
  type MarkdownInline,
} from "../../shared/interviewMarkdown";

/** Loads a downloaded image (`Bilder/…`) of the shown Bewerbung as a `data:` URL; set by the panel. */
export const InterviewImageLoader = createContext<((source: string) => Promise<string>) | null>(null);

/**
 * For a saved file that still links to remote images: downloads them (set by the file view). Without it (the
 * preview while typing) the images are downloaded when the text is saved.
 */
export const InterviewImageDownload = createContext<{ download: () => void; busy: boolean } | null>(null);

/**
 * One image. A downloaded file is loaded through the main process; an https address is never loaded (the page shows
 * no remote images): it is named and can be opened in the browser until the note is saved and the image downloaded.
 */
function InterviewImage({ image }: { image: MarkdownImage }) {
  const load = useContext(InterviewImageLoader);
  const downloader = useContext(InterviewImageDownload);
  const local = localInterviewImagePattern.test(image.src);
  const [state, setState] = useState<{ source: string; data?: string; failed?: boolean }>({ source: image.src });
  useEffect(() => {
    if (!local || !load) return;
    let active = true;
    load(image.src).then(
      (data) => { if (active) setState({ source: image.src, data }); },
      () => { if (active) setState({ source: image.src, failed: true }); },
    );
    return () => { active = false; };
  }, [image.src, load, local]);
  const current = state.source === image.src ? state : { source: image.src };
  if (local && current.data) {
    return <img className="interview-figure__image" src={current.data} alt={image.alt} title={image.alt || undefined} loading="lazy" />;
  }
  return (
    <span className="interview-figure__placeholder" role="img" aria-label={image.alt || "Bild"}>
      <ImageIcon size={28} aria-hidden="true" />
      <span>
        {local
          ? current.failed ? "Bild nicht gefunden" : "Bild wird geladen …"
          : downloader ? "Noch nicht heruntergeladen" : "Wird beim Speichern heruntergeladen"}
      </span>
      {!local && downloader ? (
        <button type="button" className="interview-figure__download" onClick={downloader.download} disabled={downloader.busy}>
          <ImageDown size={15} aria-hidden="true" /> {downloader.busy ? "Wird geladen …" : "Bilder herunterladen"}
        </button>
      ) : null}
      {!local ? (
        <a className="interview-md__link" href={image.src} target="_blank" rel="noopener noreferrer" onClick={(event) => openLink(event, image.src)}>
          Im Browser öffnen
        </a>
      ) : null}
    </span>
  );
}

/**
 * The search of the interview panel: case-insensitive, at least two characters, the words taken literally (no
 * pattern syntax). `null` when there is nothing to search for.
 */
export const interviewSearchPattern = (query: string) => {
  const words = query.trim();
  if (words.length < 2) return null;
  return new RegExp(`(${words.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "giu");
};

/** How often the search occurs in a text. */
export const countSearchHits = (text: string | undefined, pattern: RegExp | null) =>
  pattern && text ? text.match(new RegExp(pattern.source, "giu"))?.length ?? 0 : 0;

/** Text with every hit of the search wrapped in `<mark>` (as React elements, never as HTML). */
export const highlightText = (text: string, pattern: RegExp | null): ReactNode => {
  if (!pattern) return text;
  const parts = text.split(pattern);
  if (parts.length === 1) return text;
  // With the capturing group, every odd part is a hit.
  return parts.map((part, index) => (index % 2 ? <mark key={index} className="interview-mark">{part}</mark> : part));
};

/**
 * Interview notes as formatted Markdown. Every node is a React element built from the parsed tree: no HTML string
 * reaches the DOM, so text that looks like HTML stays text. Links open through the main process (http/https only).
 * `highlight` marks the hits of the panel's search.
 */
export function InterviewMarkdown({ value, highlight = null }: { value: string; highlight?: RegExp | null }) {
  const blocks = useMemo(() => parseMarkdownBlocks(value), [value]);
  return <div className="interview-md">{renderBlocks(blocks, highlight)}</div>;
}

const openLink = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
  event.preventDefault();
  void window.bewerbungsManager?.system.openExternal(href);
};

const renderInline = (nodes: readonly MarkdownInline[], mark: RegExp | null): ReactNode[] => nodes.map((node, index) => {
  switch (node.type) {
    case "text": return <Fragment key={index}>{highlightText(node.value, mark)}</Fragment>;
    case "break": return <br key={index} />;
    case "code": return <code key={index} className="interview-md__code">{highlightText(node.value, mark)}</code>;
    case "strong": return <strong key={index}>{renderInline(node.children, mark)}</strong>;
    case "em": return <em key={index}>{renderInline(node.children, mark)}</em>;
    case "del": return <del key={index}>{renderInline(node.children, mark)}</del>;
    case "image":
      return <span key={index} className="interview-md__inline-image"><InterviewImage image={node} /></span>;
    case "link":
      return (
        <a
          key={index}
          className="interview-md__link"
          href={node.href}
          target="_blank"
          rel="noopener noreferrer"
          title={node.href}
          onClick={(event) => openLink(event, node.href)}>
          {renderInline(node.children, mark)}
        </a>
      );
  }
});

const renderBlocks = (blocks: readonly MarkdownBlock[], mark: RegExp | null): ReactNode[] => blocks.map((block, index) => {
  switch (block.type) {
    case "heading":
      // Inside a question card the content headings come below the card's own heading levels.
      return (
        <div key={index} role="heading" aria-level={Math.min(block.level + 4, 6)} className={`interview-md__h${block.level}`}>
          {renderInline(block.children, mark)}
        </div>
      );
    case "paragraph":
      return <p key={index}>{renderInline(block.children, mark)}</p>;
    case "subquestion":
      return (
        <div key={index} role="heading" aria-level={6} className="interview-md__subquestion">
          {renderInline(block.children, mark)}
        </div>
      );
    case "code":
      return (
        <pre key={index} className="interview-md__pre" data-language={block.language || undefined}>
          <code>{highlightText(block.value, mark)}</code>
        </pre>
      );
    case "blockquote":
      return <blockquote key={index} className="interview-md__quote">{renderBlocks(block.children, mark)}</blockquote>;
    case "list": {
      const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{renderBlocks(item, mark)}</li>);
      return block.ordered
        ? <ol key={index} start={block.start === 1 ? undefined : block.start}>{items}</ol>
        : <ul key={index}>{items}</ul>;
    }
    case "rule":
      return <hr key={index} />;
    case "gallery":
      return (
        <section key={index} className="interview-gallery" aria-label="Bilder">
          {block.title ? (
            <div className="interview-gallery__title" role="heading" aria-level={6}>{renderInline(block.title, mark)}</div>
          ) : null}
          <div className={`interview-gallery__grid${block.items.length === 1 ? " single" : ""}`}>
            {block.items.map((item, itemIndex) => (
              <figure key={itemIndex} className="interview-figure">
                <span className="interview-figure__frame"><InterviewImage image={item.image} /></span>
                <figcaption>{item.caption ? renderInline(item.caption, mark) : highlightText(item.image.alt, mark)}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      );
    case "table":
      return (
        <div key={index} className="interview-md__table-wrap" role="region" aria-label="Tabelle" tabIndex={0}>
          <table className="interview-md__table">
            <thead>
              <tr>
                {block.header.map((cell, column) => (
                  <th key={column} scope="col" style={{ textAlign: block.align[column] ?? undefined }}>
                    {renderInline(cell, mark)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, column) => (
                    <td key={column} style={{ textAlign: block.align[column] ?? undefined }}>{renderInline(cell, mark)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
});
