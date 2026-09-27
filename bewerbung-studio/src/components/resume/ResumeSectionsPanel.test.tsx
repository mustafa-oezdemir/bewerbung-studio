import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { profileSchema } from "../../shared/schema";
import { getDefaultKnowledgeGroups } from "../../features/resume-sections/resume-section-system";
import { ResumeSectionsPanel } from "./ResumeSectionsPanel";

describe("ResumeSectionsPanel flexible blocks", () => {
  it("renders editable Pehlione blocks, placement, renderer and item controls", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      resumeKnowledgeGroups: getDefaultKnowledgeGroups("pehlione_white_blue"),
      updatedAt: new Date().toISOString(),
    });

    const html = renderToStaticMarkup(
      <ResumeSectionsPanel
        profile={profile}
        templateId="pehlione_white_blue"
        singlePageExceeded={false}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />,
    );

    expect(html).toContain("Abschnitte neu ordnen");
    expect(html).toContain("Hauptspalte");
    expect(html).toContain("Seitenspalte");
    expect(html).not.toContain("9 Lebenslauf-Bereiche");
    expect(html).not.toContain("Besondere Kenntnisse · Bausteine");
    expect(html).not.toContain("Lebenslaufdaten bearbeiten");
    expect(html.match(/aria-label="Kernkompetenzen ausblenden"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Berufserfahrung ausblenden" aria-pressed="true"');
    expect(html).toContain("Technische Schwerpunkte");
    expect(html).toContain("Bereich hinzufügen");
    expect(html).toContain("Pfeil hoch oder runter für Reihenfolge");
    expect(html).toContain('aria-label="Berufserfahrung Position"');
  });
  it("offers both placement groups and keyboard controls on a native single-column template", () => {
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
    const html = renderToStaticMarkup(<ResumeSectionsPanel profile={profile} templateId="einspaltig" layoutMode="single"
      singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()} />);
    expect(html).toContain("Im einspaltigen Layout erscheinen beide Gruppen in einer Spalte.");
    expect(html).toContain("Hauptspalte");
    expect(html).toContain("Seitenspalte");
    expect(html).toContain('aria-label="Berufserfahrung Position"');
    expect(html).toContain("Pfeil links oder rechts für Spalte");
  });
});
