import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { ClosingEditor } from "./ClosingEditor";

const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", portfolio: "https://pehlione.com/",
    github: "https://github.com/mina", updatedAt: new Date().toISOString(), ...extra,
  });
const render = (value: ReturnType<typeof profile>) =>
  parseHTML(`<html><body>${renderToStaticMarkup(
    <ClosingEditor profile={value} onChange={() => undefined} onPickSignature={() => undefined} onRemoveSignature={() => undefined} />,
  )}</body></html>`).document;
const closing = (showWebsite?: boolean) => ({
  resumeClosing: { showPlace: true, showDate: true, showSignature: true, ...(showWebsite === undefined ? {} : { showWebsite }) },
});
const websiteBox = (document: ReturnType<typeof render>) =>
  Array.from(document.querySelectorAll("label.checkbox-field"))
    .find((label) => label.textContent?.includes("Website im Footer anzeigen"))?.querySelector("input");

describe("ClosingEditor: Website im Footer anzeigen", () => {
  it("offers the switch next to Ort, Datum and Unterschrift, off for profiles that never chose it", () => {
    const labels = Array.from(render(profile()).querySelectorAll("label.checkbox-field span")).map((node) => node.textContent);
    expect(labels.slice(0, 4)).toEqual(["Ort anzeigen", "Datum anzeigen", "Unterschrift anzeigen", "Website im Footer anzeigen"]);
    expect(websiteBox(render(profile()))?.hasAttribute("checked")).toBe(false);
    expect(websiteBox(render(profile(closing(true))))?.hasAttribute("checked")).toBe(true);
  });

  it("names the link the footer prints and that it follows the Seitenränder", () => {
    const text = render(profile(closing(true))).body.textContent ?? "";
    expect(text).toContain("Steht auf jeder Seite links im Footer: https://pehlione.com/");
    expect(text).toContain("Seitenrändern");
    expect(render(profile(closing(false))).body.textContent).not.toContain("im Footer:");
  });

  it("offers no contact hidden under Persönliche Daten", () => {
    const hidden = profile({ ...closing(true), resumePersonalFieldVisibility: { website: false, github: false, linkedin: false } });
    expect(render(hidden).body.textContent).toContain("Im Profil ist keine Website hinterlegt");
    const githubOnly = profile({ ...closing(true), resumePersonalFieldVisibility: { website: false } });
    expect(render(githubOnly).body.textContent).toContain("im Footer: https://github.com/mina");
  });
});
