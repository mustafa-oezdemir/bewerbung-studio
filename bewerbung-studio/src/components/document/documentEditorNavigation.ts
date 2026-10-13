/** Scroll the editor's own viewport, or its position in the page at narrow widths. */
export const scrollDocumentEditor = (editor: HTMLElement | null, direction: "top" | "bottom") => {
  if (!editor) return;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const overflow = window.getComputedStyle(editor).overflowY;
  if ((overflow === "auto" || overflow === "scroll") && editor.scrollHeight > editor.clientHeight) {
    editor.scrollTo({ top: direction === "top" ? 0 : editor.scrollHeight, behavior });
    return;
  }
  const box = editor.getBoundingClientRect();
  window.scrollTo({ top: Math.max(0, window.scrollY + (direction === "top"
    ? box.top - 96 : box.bottom - window.innerHeight)), behavior });
};
