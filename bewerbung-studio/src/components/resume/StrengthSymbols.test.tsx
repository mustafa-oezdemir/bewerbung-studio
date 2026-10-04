import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModernStrengthsSection } from "./templates/modern/ModernStrengthsSection";
import { profileSchema } from "../../shared/schema";
import { strengthSymbolOptions } from "../../shared/strengthSymbols";

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
});
