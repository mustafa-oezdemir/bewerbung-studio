import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { deckblattDesigns } from "../../shared/deckblattDesigns";
import { DeckblattDesignPicker } from "./DeckblattDesignPicker";

const options = (node: ReactNode): ReactElement<{ onClick: () => void; "data-deckblatt-design": string }>[] => {
  const found: ReactElement<{ onClick: () => void; "data-deckblatt-design": string }>[] = [];
  const visit = (value: ReactNode) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(value)) return;
    if (value.type === "button") found.push(value as never);
    visit(value.props.children);
  };
  visit(node);
  return found;
};

describe("DeckblattDesignPicker", () => {
  it("offers every registered design as one radio option and marks the chosen one", () => {
    const markup = renderToStaticMarkup(<DeckblattDesignPicker value="pastell" onChange={() => undefined} />);
    expect(markup.match(/role="radio"/g)).toHaveLength(deckblattDesigns.length);
    for (const design of deckblattDesigns) expect(markup).toContain(design.label);
    expect(markup.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-checked="true"[^>]*data-deckblatt-design="pastell"|data-deckblatt-design="pastell"[^>]*aria-checked="true"/);
  });

  it("reports the design the user picks", () => {
    const onChange = vi.fn();
    const buttons = options(DeckblattDesignPicker({ value: "klassisch", onChange }));
    expect(buttons.map((button) => button.props["data-deckblatt-design"])).toEqual(deckblattDesigns.map((design) => design.id));
    buttons[2].props.onClick();
    expect(onChange).toHaveBeenCalledWith("akzentband");
  });
});
