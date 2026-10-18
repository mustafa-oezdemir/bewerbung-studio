import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModernStrengthsSection } from "./templates/modern/ModernStrengthsSection";
import { profileSchema } from "../../shared/schema";
import { categorySymbolOptions, strengthSymbolOptions } from "../../shared/strengthSymbols";

describe("strength symbols", () => {
  it("renders saved symbols instead of automatic technology logos", () => {
    for (const symbol of strengthSymbolOptions) {
      const profile = profileSchema.parse({ id: crypto.randomUUID(), firstName: "Mina", lastName: "Kaya", isDefault: true,
        updatedAt: new Date().toISOString(), strengths: [{ id: crypto.randomUUID(), title: "React", description: "Entwicklung", iconId: symbol.id }] });
      const html = renderToStaticMarkup(<ModernStrengthsSection profile={profile} />);
      expect(html).toContain(`data-strength-symbol="${symbol.id}" style="color:inherit"`);
      expect(html).not.toContain('data-brand="react"');
    }
  });

  it("draws category symbols, chosen or detected, in the template's icon colour like technology marks", () => {
    const render = (title: string, iconId: string) => renderToStaticMarkup(<ModernStrengthsSection profile={profileSchema.parse({
      id: crypto.randomUUID(), firstName: "Mina", lastName: "Kaya", isDefault: true, updatedAt: new Date().toISOString(),
      strengths: [{ id: crypto.randomUUID(), title, description: "Entwicklung", iconId }] })} />);
    for (const symbol of categorySymbolOptions) {
      const chosen = render("React", symbol.id);
      expect(chosen).toContain(`data-strength-symbol="${symbol.id}"`);
      expect(chosen).not.toContain("color:inherit");
      expect(chosen).not.toContain('data-brand="react"');
    }
    const detected = render("Datenbank", "");
    expect(detected).toContain('data-strength-symbol="symbol:database"');
    expect(detected).not.toContain("color:inherit");
    expect(render("Datenbank", "symbol:database")).toBe(detected);
  });
});
