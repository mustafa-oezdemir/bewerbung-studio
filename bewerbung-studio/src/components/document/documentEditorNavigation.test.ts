import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollDocumentEditor } from "./documentEditorNavigation";

afterEach(() => vi.unstubAllGlobals());

describe("Lebenslauf editor navigation", () => {
  const setup = (overflow: string, reduced: boolean) => {
    const pageScroll = vi.fn();
    vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }), getComputedStyle: () => ({ overflowY: overflow }),
      scrollTo: pageScroll, scrollY: 300, innerHeight: 800 });
    const editorScroll = vi.fn();
    const editor = { scrollHeight: 2200, clientHeight: 500, scrollTo: editorScroll,
      getBoundingClientRect: () => ({ top: 120, bottom: 2320 }) } as unknown as HTMLElement;
    return { editor, editorScroll, pageScroll };
  };

  it("moves the desktop editor to either end without scrolling the page or PDF viewport", () => {
    const { editor, editorScroll, pageScroll } = setup("auto", false);
    scrollDocumentEditor(editor, "bottom");
    scrollDocumentEditor(editor, "top");
    expect(editorScroll.mock.calls).toEqual([[{ top: 2200, behavior: "smooth" }], [{ top: 0, behavior: "smooth" }]]);
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it("uses the editor's page position at narrow widths and honours reduced motion", () => {
    const { editor, editorScroll, pageScroll } = setup("visible", true);
    scrollDocumentEditor(editor, "top");
    scrollDocumentEditor(editor, "bottom");
    expect(pageScroll.mock.calls).toEqual([[{ top: 324, behavior: "auto" }], [{ top: 1820, behavior: "auto" }]]);
    expect(editorScroll).not.toHaveBeenCalled();
  });
});
