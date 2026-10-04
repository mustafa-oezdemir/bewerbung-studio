import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { setResumeSectionTitle } from "../../features/resume-sections/resume-sections";
import { setResumeSummaryVisible } from "../../shared/resumeSummary";
import { profileSchema, type ApplicantProfile } from "../../shared/schema";
import { ProfileView } from "../../views/ProfileView";
import { ResumeSectionsPanel } from "../resume/ResumeSectionsPanel";
import { SummaryEditor } from "./SummaryEditor";

type MockStoreState = {
  workspace: { profiles: unknown[]; applications: unknown[] };
  selectedProfileId: string | undefined;
  selectedApplicationId: string | undefined;
  saveProfile: ReturnType<typeof vi.fn>;
  removeProfile: ReturnType<typeof vi.fn>;
  selectProfile: ReturnType<typeof vi.fn>;
};
const mockedStore = vi.hoisted(() => ({ state: undefined as MockStoreState | undefined }));
vi.mock("../../store/useAppStore", () => ({
  useAppStore: Object.assign((selector: (state: MockStoreState) => unknown) => selector(mockedStore.state!), {
    getState: () => mockedStore.state,
  }),
}));

const words = (count: number, sentences: number) => {
  const per = Math.floor(count / sentences);
  return Array.from({ length: sentences }, (_, index) =>
    `${Array.from({ length: index === sentences - 1 ? count - per * (sentences - 1) : per }, () => "Wort").join(" ")}.`).join(" ");
};
const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Mustafa", lastName: "Özdemir", summary: words(72, 4),
    updatedAt: new Date().toISOString(), ...extra,
  });
const dom = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const noop = () => undefined;
const editor = (source: ApplicantProfile) => dom(renderToStaticMarkup(<SummaryEditor profile={source} onChange={noop} />));

describe("4. Kurzprofil editor", () => {
  it("edits the profile's Kurzprofil in a roomy text area", () => {
    const document = editor(profile());
    const textarea = document.querySelector("textarea")!;
    expect(Number(textarea.getAttribute("rows"))).toBeGreaterThanOrEqual(6);
    expect(textarea.textContent).toBe(words(72, 4));
    expect(document.querySelector('label[for]')?.textContent).toBe("Text");
  });

  it("counts words and sentences live and recommends 3–5 Sätze, ca. 50–100 Wörter", () => {
    const counter = editor(profile()).querySelector(".summary-counter")!;
    expect(counter.querySelector("strong")?.textContent).toBe("72 Wörter · 4 Sätze");
    expect(counter.textContent).toContain("Empfohlener Umfang: 3–5 Sätze · ca. 50–100 Wörter");
    expect(counter.querySelector("small.is-recommended")).not.toBeNull();
  });

  it("only hints when the text is shorter or longer, and never marks it as an error", () => {
    const short = editor(profile({ summary: words(48, 4) })).querySelector(".summary-counter")!;
    expect(short.textContent).toContain("Empfohlen: 3–5 Sätze · ca. 50–100 Wörter");
    expect(short.textContent).toContain("Etwas ausführlicher darf es sein.");
    const long = editor(profile({ summary: words(105, 4) })).querySelector(".summary-counter")!;
    expect(long.textContent).toContain("Etwas kürzer wirkt im Lebenslauf klarer.");
    for (const node of [short, long]) {
      expect(node.querySelector(".is-recommended")).toBeNull();
      expect(node.closest("[role=alert]")).toBeNull();
    }
    expect(editor(profile({ summary: words(48, 4) })).querySelector("textarea")?.hasAttribute("required")).toBe(false);
  });

  it("shows a calm empty state and the soft recommendation while there is no text", () => {
    const document = editor(profile({ summary: "" }));
    expect(document.body.textContent).toContain("Noch kein Kurzprofil hinterlegt.");
    expect(document.querySelector(".summary-counter strong")?.textContent).toBe("0 Wörter · 0 Sätze");
    expect(document.querySelector(".summary-counter")?.textContent).toContain("Empfohlen: 3–5 Sätze · ca. 50–100 Wörter");
  });

  it("lists the checks that can be decided without guessing: text, sentences, words", () => {
    const checks = (source: ApplicantProfile) => Array.from(editor(source).querySelectorAll(".summary-checks li")).map((node) => `${node.classList.contains("is-done") ? "✓" : "○"} ${node.textContent?.trim()}`);
    expect(checks(profile())).toEqual(["✓ Text vorhanden", "✓ 3–5 Sätze", "✓ ca. 50–100 Wörter"]);
    expect(checks(profile({ summary: "" }))).toEqual(["○ Text vorhanden", "○ 3–5 Sätze", "○ ca. 50–100 Wörter"]);
    expect(checks(profile({ summary: words(30, 2) }))).toEqual(["✓ Text vorhanden", "○ 3–5 Sätze", "○ ca. 50–100 Wörter"]);
  });

  it("explains what to write without writing it: content hints, questions and a tip", () => {
    const guide = editor(profile()).querySelector(".summary-guide")!;
    expect(Array.from(guide.querySelectorAll(":scope > ul li")).map((node) => node.textContent)).toEqual([
      "Beruflicher Schwerpunkt", "Relevante Erfahrung", "Kernkompetenzen", "Besondere Erfolge", "Berufliches Ziel",
    ]);
    expect(Array.from(guide.querySelectorAll("details li")).map((node) => node.textContent)).toEqual([
      "Wer bin ich?", "Was kann ich?", "Welche Erfahrung bringe ich mit?", "Welchen Schwerpunkt suche ich?",
    ]);
    expect(guide.textContent).toContain("Tipp: Aktiv und konkret formulieren");
    expect(guide.textContent).toContain("Ich-Form");
    // The text area holds exactly what the user wrote: no suggestion is pre-filled.
    expect(editor(profile({ summary: "" })).querySelector("textarea")?.textContent).toBe("");
  });

  it("offers Kurzprofil, Über mich and Persönliches Profil as the title, Kurzprofil by default", () => {
    const select = editor(profile()).querySelector('select[aria-label="Kurzprofil Überschrift"]')!;
    expect(Array.from(select.querySelectorAll("option")).map((option) => option.textContent)).toEqual(["Kurzprofil", "Über mich", "Persönliches Profil"]);
    expect(select.querySelector("option[selected]")?.textContent).toBe("Kurzprofil");
    const renamed = editor(setResumeSectionTitle(profile(), "summary", "Über mich")).querySelector('select[aria-label="Kurzprofil Überschrift"]')!;
    expect(renamed.querySelector("option[selected]")?.textContent).toBe("Über mich");
  });

  it("keeps a title the user chose earlier selectable", () => {
    const older = profile({ resumeSectionTitles: { summary: "Mein Profil" } });
    const select = editor(older).querySelector('select[aria-label="Kurzprofil Überschrift"]')!;
    expect(Array.from(select.querySelectorAll("option")).map((option) => option.textContent)).toEqual(["Kurzprofil", "Über mich", "Persönliches Profil", "Mein Profil"]);
    expect(select.querySelector("option[selected]")?.textContent).toBe("Mein Profil");
    // The title an older profile stored as its default is just the default.
    const legacy = editor(profile({ resumeSectionTitles: { summary: "Zusammenfassung" } })).querySelector('select[aria-label="Kurzprofil Überschrift"]')!;
    expect(legacy.querySelector("option[selected]")?.textContent).toBe("Kurzprofil");
  });

  it("switches the section on and off without touching the text", () => {
    const checkbox = (source: ApplicantProfile) => editor(source).querySelector(".summary-visibility input")!;
    expect(editor(profile()).querySelector(".summary-visibility")?.textContent).toBe("Im Lebenslauf anzeigen");
    expect(checkbox(profile()).hasAttribute("checked")).toBe(true);
    const hidden = setResumeSummaryVisible(profile(), false);
    expect(checkbox(hidden).hasAttribute("checked")).toBe(false);
    expect(editor(hidden).querySelector("textarea")?.textContent).toBe(words(72, 4));
  });
});

describe("Profil → 4. Kurzprofil", () => {
  it("is the fourth section, recommended but not required", () => {
    mockedStore.state = {
      workspace: { profiles: [], applications: [] }, selectedProfileId: undefined, selectedApplicationId: undefined,
      saveProfile: vi.fn(), removeProfile: vi.fn(), selectProfile: vi.fn(),
    };
    const sections = Array.from(dom(renderToStaticMarkup(<ProfileView onSaved={noop} />)).querySelectorAll("form > section.profile-editor-section"));
    expect(sections.slice(0, 5).map((section) => section.querySelector("h3")?.textContent)).toEqual([
      "1. Überschrift", "2. Persönliche Daten", "3. Bewerbungsfoto", "4. Kurzprofil", "5. Beruflicher Werdegang",
    ]);
    const summary = sections[3];
    expect(summary.querySelector(".profile-recommended-badge")?.textContent).toBe("Empfohlen");
    expect(summary.querySelector(".profile-required-badge")).toBeNull();
    expect(summary.textContent).toContain("Fassen Sie Ihre wichtigsten Erfahrungen, Kompetenzen und beruflichen Schwerpunkte in wenigen Sätzen zusammen.");
    expect(summary.querySelector("textarea")).not.toBeNull();
  });
});

describe("Lebenslauf panel: gemeinsames Kurzprofil", () => {
  const card = (source: ApplicantProfile, legacySummary = "") => {
    const panel = dom(renderToStaticMarkup(
      <ResumeSectionsPanel profile={source} templateId="modern" singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()}
        legacySummary={legacySummary} initialExpanded="summary" />,
    ));
    return Array.from(panel.querySelectorAll("article.manager-card")).find((node) => node.querySelector(".manager-card-title")?.textContent?.trim() === "Kurzprofil")!;
  };

  it("edits the same profile summary as ProfileView", () => {
    const source = profile({ summary: "Text aus dem Profil." });
    const element = card(source);
    expect(element.querySelector(".summary-editor textarea")?.textContent).toBe("Text aus dem Profil.");
  });

  it("preserves old application text separately and offers adoption", () => {
    const element = card(profile({ summary: "Text aus dem Profil." }), "Nur für diese Bewerbung.");
    expect(element.querySelector(".summary-editor textarea")?.textContent).toBe("Text aus dem Profil.");
    expect(element.querySelector(".legacy-summary blockquote")?.textContent).toBe("Nur für diese Bewerbung.");
    expect(element.textContent).toContain("In das Profil übernehmen");
  });

  it("is calm when there is no text at all", () => {
    const element = card(profile({ summary: "" }));
    expect(element.textContent).toContain("Noch kein Kurzprofil hinterlegt.");
  });
});
