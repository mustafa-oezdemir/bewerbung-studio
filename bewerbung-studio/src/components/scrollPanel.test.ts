import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollPanel } from "./scrollPanel";

afterEach(() => vi.unstubAllGlobals());

describe("Nach oben / Nach unten", () => {
  const setup = (overflow: string, reduced: boolean) => {
    const pageScroll = vi.fn();
    vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }), getComputedStyle: () => ({ overflowY: overflow }),
      scrollTo: pageScroll, scrollY: 300, innerHeight: 800 });
    const panelScroll = vi.fn();
    const panel = { scrollHeight: 2200, clientHeight: 500, scrollTo: panelScroll,
      getBoundingClientRect: () => ({ top: 120, bottom: 2320 }) } as unknown as HTMLElement;
    return { panel, panelScroll, pageScroll };
  };

  it("moves a panel with its own scrollbar (desktop editor) to either end without scrolling the page or PDF viewport", () => {
    const { panel, panelScroll, pageScroll } = setup("auto", false);
    scrollPanel(panel, "bottom");
    scrollPanel(panel, "top");
    expect(panelScroll.mock.calls).toEqual([[{ top: 2200, behavior: "smooth" }], [{ top: 0, behavior: "smooth" }]]);
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it("scrolls the page to the panel's ends when the page scrolls (Bewerbungsdetail, narrow widths) and honours reduced motion", () => {
    const { panel, panelScroll, pageScroll } = setup("clip", true);
    scrollPanel(panel, "top");
    scrollPanel(panel, "bottom");
    expect(pageScroll.mock.calls).toEqual([[{ top: 324, behavior: "auto" }], [{ top: 1820, behavior: "auto" }]]);
    expect(panelScroll).not.toHaveBeenCalled();
  });
});
