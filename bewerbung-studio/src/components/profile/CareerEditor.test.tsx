import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { setResumeSectionTitle } from "../../features/resume-sections/resume-sections";
import { profileSchema, type ApplicantProfile } from "../../shared/schema";
import { ProfileView } from "../../views/ProfileView";
import { ResumeDataEditor } from "../resume/ResumeDataEditor";
import { CareerEditor, createExperience } from "./CareerEditor";

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

const ids = [1, 2, 3].map((index) => `8e000000-0000-4000-8000-00000000000${index}`);
const station = (index: number, fields: Record<string, unknown> = {}) => ({
  id: ids[index],
  from: "11/2021",
  to: "10/2024",
  role: `Rolle ${index + 1}`,
  company: `Firma ${index + 1}`,
  achievements: [],
  ...fields,
});
const profile = (experiences: Array<Record<string, unknown>> = [station(0)], extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: "8e000000-0000-4000-8000-0000000000ff", isDefault: true, firstName: "Mina", lastName: "Kaya",
    updatedAt: "2026-10-02T10:00:00.000Z", experiences, ...extra,
  });
const dom = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const noop = () => undefined;
const editor = (source: ApplicantProfile, defaultOpenId: string | null = null) =>
  dom(renderToStaticMarkup(<CareerEditor profile={source} onChange={noop} defaultOpenId={defaultOpenId} />));
const text = (node: Element | null | undefined) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();

describe("5. Beruflicher Werdegang editor", () => {
  it("shows a station as a short card: role, employer with legal form, city, period", () => {
    const document = editor(profile([station(0, { legalForm: "GmbH", city: "Berlin", from: "11/2024", to: "", isCurrent: true })]));
    const card = document.querySelector(".career-card")!;
    expect(Array.from(card.querySelectorAll(".career-card__summary > *")).map((node) => text(node))).toEqual(["Rolle 1", "Firma 1 GmbH · Berlin", "11/2024 – heute"]);
    // Collapsed: the groups are not drawn until the card is opened.
    expect(card.querySelector(".career-card__body")).toBeNull();
    expect(card.querySelector("button[aria-expanded=false]")?.textContent).toContain("Bearbeiten");
  });

  it("summarises how many tasks, projects, technologies and achievements a station holds", () => {
    const card = editor(profile([station(0, { tasks: ["a", "b"], projects: ["p"], technologies: ["Go", "SQL", ""], achievements: ["e"] })])).querySelector(".career-card")!;
    expect(text(card)).toContain("2 Aufgaben · 1 Projekt · 2 Technologien · 1 Erfolg");
  });

  it("opens into the groups Zeitraum, Position & Arbeitgeber, Aufgaben, Projekte, Technologien, Erfolge and Weitere Angaben", () => {
    const card = editor(profile(), ids[0]).querySelector(".career-card")!;
    expect(Array.from(card.querySelectorAll("legend, summary")).map((node) => text(node)).filter((value) => /^\d\./.test(value))).toEqual([
      "1. Zeitraum", "2. Position & Arbeitgeber", "3. Aufgaben", "4. Projekte", "5. Technologien / Werkzeuge", "6. Erfolge", "7. Weitere Angaben",
    ]);
    const labels = Array.from(card.querySelectorAll("label, .flexible-date-field > span")).map((node) => text(node));
    for (const label of ["Von *", "Bis", "Aktuelle Position", "Position *", "Unternehmen *", "Rechtsform", "Ort", "Beschäftigungsart"]) expect(labels).toContain(label);
    // Description and team size sit in the collapsed "Weitere Angaben".
    const more = card.querySelector("details.career-more")!;
    expect(more.hasAttribute("open")).toBe(false);
    expect(text(more)).toContain("Kurze Beschreibung");
    expect(text(more)).toContain("Team / Verantwortung");
    expect(Array.from(more.querySelectorAll(".career-display-options label")).map((node) => text(node))).toEqual(["Ausführlich", "Kompakt"]);
  });

  it("K. a current station shows 'heute' as a read-only end and keeps the checkbox on", () => {
    const card = editor(profile([station(0, { to: "10/2024", isCurrent: true })]), ids[0]).querySelector(".career-card")!;
    const end = Array.from(card.querySelectorAll(".flexible-date-field")).find((field) => text(field.querySelector("span")) === "Bis")!;
    const input = end.querySelector("input[type=text]")!;
    expect(input.getAttribute("value")).toBe("heute");
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(card.querySelector(".checkbox-field input")?.hasAttribute("checked")).toBe(true);
    expect(text(card.querySelector(".career-group .field-hint"))).toBe("Angezeigt als: 11/2021 – heute");
  });

  it("D. shows how company and legal form are combined, without doubling it", () => {
    const shown = (company: string) => text(editor(profile([station(0, { company, legalForm: "GmbH" })]), ids[0]).querySelector(".career-card"));
    expect(shown("Muster")).toContain("Angezeigt als: Muster GmbH");
    expect(shown("Muster GmbH")).toContain("Angezeigt als: Muster GmbH");
    expect(shown("Muster GmbH")).not.toContain("Muster GmbH GmbH");
  });

  it("J. recommends 3–6 points, and only hints when there are more; saving is never blocked", () => {
    const hint = (tasks: string[]) => text(editor(profile([station(0, { tasks })]), ids[0]).querySelector(".career-count"));
    expect(hint([])).toBe("0 Stichpunkte · Empfohlen: 3–6 relevante Punkte");
    expect(hint(["a", "b", "c"])).toBe("3 Stichpunkte · Empfohlen: 3–6 relevante Punkte");
    expect(hint(Array.from({ length: 8 }, (_, index) => `Punkt ${index}`))).toContain("Für einen übersichtlichen Lebenslauf besser auf relevante Punkte konzentrieren.");
    const many = editor(profile([station(0, { tasks: Array.from({ length: 8 }, (_, index) => `Punkt ${index}`) })]), ids[0]);
    expect(many.querySelector("[role=alert]")).toBeNull();
    expect(many.querySelector(".career-count.is-many")).not.toBeNull();
    expect(many.querySelector("input[required], textarea[required]")).toBeNull();
  });

  it("explains Problem → Aktion → Resultat and fills nothing in", () => {
    const card = editor(profile(), ids[0]).querySelector(".career-card")!;
    expect(text(card)).toContain("Problem → Aktion → Resultat");
    expect(text(card)).toContain("Eine Zahl ist nicht nötig.");
    expect(card.querySelectorAll("li.entry-list-editor__item, .entry-list-editor li").length).toBe(0);
  });

  it("offers employment type and legal form as suggestions next to free text", () => {
    const card = editor(profile(), ids[0]).querySelector(".career-card")!;
    const types = Array.from(card.querySelectorAll("datalist[id$=type-list] option")).map((option) => option.getAttribute("value"));
    expect(types).toEqual(expect.arrayContaining(["Vollzeit", "Teilzeit", "Werkstudent", "Praktikum", "Freiberuflich"]));
    expect(Array.from(card.querySelectorAll("datalist[id$=legal-list] option")).map((option) => option.getAttribute("value"))).toContain("GmbH");
  });

  it("C. keeps a manual order and says so, with a button to sort once on request", () => {
    const sorted = editor(profile([station(0, { from: "07/2022", to: "", isCurrent: true }), station(1, { from: "01/2018", to: "06/2022" })]));
    expect(text(sorted.querySelector(".career-sorting strong"))).toBe("Neueste Station zuerst");
    expect(sorted.body.textContent).not.toContain("Nach Datum sortieren");
    const manual = editor(profile([station(0, { from: "01/2018", to: "06/2022" }), station(1, { from: "07/2022", to: "", isCurrent: true })]));
    expect(text(manual.querySelector(".career-sorting strong"))).toBe("Manuelle Reihenfolge");
    expect(text(manual.querySelector(".career-sorting"))).toContain("Nach Datum sortieren (neueste zuerst)");
    // The stations stay exactly in the user's order.
    expect(Array.from(manual.querySelectorAll(".career-card__summary strong")).map((node) => text(node))).toEqual(["Rolle 1", "Rolle 2"]);
    // Every station can be moved with the keyboard as well as by dragging.
    expect(manual.querySelectorAll(".career-card[draggable=true]")).toHaveLength(2);
    expect(manual.querySelectorAll(".career-card .order-controls, .career-card [aria-label*=nach]").length).toBeGreaterThan(0);
  });

  it("asks before deleting: every station has a delete button that opens a confirmation", () => {
    const document = editor(profile());
    expect(document.querySelector('button[aria-label="Rolle 1 löschen"]')).not.toBeNull();
    // No confirmation is drawn until the delete button is pressed.
    expect(document.querySelector("[role=alertdialog]")).toBeNull();
  });

  it("hints at an obvious gap and at a date it cannot read, and never invents a reason", () => {
    const gap = editor(profile([station(0, { from: "01/2022", to: "heute" }), station(1, { from: "01/2015", to: "06/2019" })]));
    const hint = text(gap.querySelector(".career-toolbar + .career-hint"));
    expect(hint).toContain("Zwischen 06/2019 und 01/2022 besteht eine zeitliche Lücke");
    expect(hint).toContain("Das ist nur ein Hinweis");
    expect(gap.querySelectorAll(".career-card")).toHaveLength(2);
    const unreadable = editor(profile([station(0, { from: "Sommer 2019", to: "10/2020" })]));
    expect(text(unreadable.querySelector(".career-card .career-hint"))).toContain("Das Datum „Sommer 2019“ kann nicht gelesen werden");
    expect(editor(profile([station(0)])).querySelector(".career-hint")).toBeNull();
  });

  it("starts empty: no station and no pre-filled text", () => {
    const empty = editor(profile([]));
    expect(empty.querySelector(".career-card")).toBeNull();
    expect(text(empty.querySelector(".entry-list-editor__empty"))).toBe("Noch keine Station erfasst.");
    expect(createExperience()).toMatchObject({ from: "", to: "", role: "", company: "", isCurrent: false, compact: false, tasks: [], projects: [], technologies: [], achievements: [] });
    expect(text(empty.querySelector(".career-toolbar button.secondary"))).toBe("Station hinzufügen");
  });

  it("offers Beruflicher Werdegang first as the title and keeps a chosen title selectable", () => {
    const select = editor(profile()).querySelector('select[aria-label="Beruflicher Werdegang Überschrift"]')!;
    expect(Array.from(select.querySelectorAll("option")).map((option) => option.textContent)).toEqual([
      "Beruflicher Werdegang", "Berufserfahrung", "Berufliche Erfahrung", "Praxiserfahrung", "Berufspraxis", "Berufs- und Projekterfahrung",
    ]);
    expect(select.querySelector("option[selected]")?.textContent).toBe("Beruflicher Werdegang");
    expect(editor(setResumeSectionTitle(profile(), "experience", "Praxiserfahrung")).querySelector("option[selected]")?.textContent).toBe("Praxiserfahrung");
    // The title an older profile stored as its default is just the new default.
    expect(editor(profile([station(0)], { resumeSectionTitles: { experience: "Berufserfahrung" } })).querySelector("option[selected]")?.textContent).toBe("Beruflicher Werdegang");
  });
});

describe("Profil → 5. Beruflicher Werdegang", () => {
  it("is the fifth section, required, and uses the shared editor", () => {
    mockedStore.state = {
      workspace: { profiles: [], applications: [] }, selectedProfileId: undefined, selectedApplicationId: undefined,
      saveProfile: vi.fn(), removeProfile: vi.fn(), selectProfile: vi.fn(),
    };
    const sections = Array.from(dom(renderToStaticMarkup(<ProfileView onSaved={noop} />)).querySelectorAll("form > section.profile-editor-section"));
    const career = sections[4];
    expect(career.querySelector("h3")?.textContent).toBe("5. Beruflicher Werdegang");
    expect(career.querySelector(".profile-required-badge")?.textContent).toBe("Pflicht");
    expect(career.querySelector(".career-editor")).not.toBeNull();
    // The old second form for the same stations is gone.
    expect(sections.filter((section) => section.querySelector("h3")?.textContent === "Berufserfahrung")).toHaveLength(0);
  });
});

describe("Lebenslauf panel: Beruflicher Werdegang", () => {
  it("edits the same stations with the same editor and no second title field", () => {
    const html = renderToStaticMarkup(
      <ResumeDataEditor profile={profile([station(0, { tasks: ["Aufgabe"] })])} section="experience" defaultOpen onPreview={noop} onSave={async () => undefined} />,
    );
    const document = dom(html);
    expect(document.querySelector(".career-editor")).not.toBeNull();
    expect(document.querySelector('select[aria-label="Beruflicher Werdegang Überschrift"]')).toBeNull();
    expect(text(document.querySelector(".career-card__summary"))).toContain("Rolle 1");
  });
});
