/** Scroll the panel's own viewport, or its position in the page when the page scrolls (narrow widths, Bewerbungsdetail). */
export const scrollPanel = (panel: HTMLElement | null, direction: "top" | "bottom") => {
  if (!panel) return;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const overflow = window.getComputedStyle(panel).overflowY;
  if ((overflow === "auto" || overflow === "scroll") && panel.scrollHeight > panel.clientHeight) {
    panel.scrollTo({ top: direction === "top" ? 0 : panel.scrollHeight, behavior });
    return;
  }
  const box = panel.getBoundingClientRect();
  window.scrollTo({ top: Math.max(0, window.scrollY + (direction === "top"
    ? box.top - 96 : box.bottom - window.innerHeight)), behavior });
};
