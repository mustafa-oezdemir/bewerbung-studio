import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { profileSchema } from "../../shared/schema";
import { getDefaultKnowledgeGroups } from "../../features/resume-sections/resume-section-system";
import { getManagerSections } from "../../features/resume-sections/resume-manager";
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
    expect(html).toContain('aria-label="Beruflicher Werdegang ausblenden" aria-pressed="true"');
    expect(html).toContain("Technische Schwerpunkte");
    expect(html).toContain("Bereich hinzufügen");
    expect(html).toContain("Pfeil hoch oder runter für Reihenfolge");
    expect(html).toContain('aria-label="Beruflicher Werdegang Position"');
  });
  it.each(["tabellarisch", "klassisch", "einspaltig", "ivy-league"])("shows one global section list in %s single layout", (templateId) => {
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
    const html = renderToStaticMarkup(<ResumeSectionsPanel profile={profile} templateId={templateId} layoutMode="single"
      singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()} />);
    expect(html).toContain("Im einspaltigen Layout werden alle Bereiche in einer gemeinsamen Reihenfolge angeordnet.");
    expect(html.match(/>Reihenfolge im Lebenslauf</g)).toHaveLength(1);
    expect(html.match(/draggable="true"/g)).toHaveLength(getManagerSections(profile, templateId).filter((entry) => !entry.fixed).length);
    expect(html).not.toContain(">Hauptspalte<");
    expect(html).not.toContain(">Seitenspalte<");
    expect(html).not.toContain('aria-label="Beruflicher Werdegang Position"');
    expect(html).not.toContain("Pfeil links oder rechts für Spalte");
    expect(html).toContain('aria-label="Kurzprofil nach oben" disabled');
    expect(html.match(/aria-label="[^"]+ nach unten" disabled/g)).toHaveLength(1);
  });
  it.each(["tabellarisch", "klassisch", "einspaltig", "ivy-league"])("restores zone controls in %s two-column layout", (templateId) => {
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
    const html = renderToStaticMarkup(<ResumeSectionsPanel profile={profile} templateId={templateId} layoutMode="two-column"
      singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()} />);
    expect(html).toContain(">Hauptspalte<");
    expect(html).toContain(">Seitenspalte<");
    expect(html).toContain('aria-label="Beruflicher Werdegang Position"');
    expect(html).toContain("Pfeil links oder rechts für Spalte");
  });
  it("shows Tabellarisch in one movable order across saved zones", () => {
    const base = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
    const profile = { ...base, resumeManagerLayouts: { ...base.resumeManagerLayouts,
      tabellarisch: [
        { id: "experience", zone: "main" as const }, { id: "education", zone: "main" as const },
        { id: "summary", zone: "sidebar" as const }, { id: "strengths", zone: "sidebar" as const },
      ],
    } };
    const html = renderToStaticMarkup(<ResumeSectionsPanel profile={profile} templateId="tabellarisch" layoutMode="single"
      singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()} />);
    expect(html.indexOf('aria-label="Beruflicher Werdegang nach oben"')).toBeLessThan(html.indexOf('aria-label="Kurzprofil nach oben"'));
    expect(html).toContain('aria-label="Kurzprofil nach oben"');
    expect(html).not.toContain('aria-label="Kurzprofil nach oben" disabled');
    expect(html).toContain("Reihenfolge im Lebenslauf");
  });
});
