import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GlobalApplicationSearch } from "./GlobalApplicationSearch";

describe("GlobalApplicationSearch", () => {
  it("renders an actual search input instead of a navigation button", () => {
    const markup = renderToStaticMarkup(
      <GlobalApplicationSearch applications={[]} onSelect={vi.fn()} />,
    );

    expect(markup).toContain('type="search"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="Bewerbungen suchen"');
  });
});
