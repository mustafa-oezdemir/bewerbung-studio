import { useLayoutEffect, useRef } from "react";
import { motivationCss, type MotivationModel } from "../../shared/motivationDocument";
import { MotivationPage } from "./MotivationPage";

/**
 * How the PDF divides the page into A4 pages. Every PDF page repeats the top and bottom margin
 * (`box-decoration-break:clone`), so a page holds 297 mm minus both margins. Lengths come from the computed style
 * (CSS pixels, untouched by the preview's zoom); the page is 210 mm wide.
 */
export const measureMotivationPages = (page: Element) => {
  const style = getComputedStyle(page);
  const pxPerMm = Number.parseFloat(style.width) / 210;
  if (!pxPerMm) return { pages: 1, firstBreakMm: 297 };
  const mm = (value: string) => (Number.parseFloat(value) || 0) / pxPerMm;
  const top = mm(style.paddingTop);
  const bottom = mm(style.paddingBottom);
  const content = mm(style.height) - top - bottom;
  const perPage = Math.max(1, 297 - top - bottom);
  const pages = content <= perPage + 0.5 ? 1 : 1 + Math.ceil((content - perPage - 0.5) / perPage);
  return { pages, firstBreakMm: 297 - bottom };
};

/**
 * The Motivationsschreiben of the preview: the page of `MotivationPage` with the stylesheet the PDF uses. A text
 * longer than one A4 page is never cut or scaled; the preview marks where the PDF's first page ends and reports the
 * page count, so the editor can say so.
 */
export function MotivationPreview({
  model,
  onPageCount,
}: {
  model: MotivationModel;
  onPageCount?: (pages: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const pagesRef = useRef(0);
  useLayoutEffect(() => {
    const element = host.current?.querySelector(".motivation");
    if (!element) return;
    const measure = () => {
      const { pages, firstBreakMm } = measureMotivationPages(element);
      if (host.current) host.current.dataset.pages = String(pages);
      // The mark sits where the first page's text ends in the PDF (above the bottom margin).
      host.current?.querySelector<HTMLElement>(".motivation-page-break")?.style.setProperty("top", `${firstBreakMm}mm`);
      if (pages !== pagesRef.current) {
        pagesRef.current = pages;
        onPageCount?.(pages);
      }
    };
    measure();
    void document.fonts?.ready.then(measure);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  });
  return (
    <>
      <style>{motivationCss}</style>
      <div ref={host} className="motivation-host">
        <MotivationPage model={model} />
        <i className="motivation-page-break" aria-hidden="true" />
      </div>
    </>
  );
}
