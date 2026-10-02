import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { profileSchema } from "../../shared/schema";
import { setResumeHeading } from "../../shared/resumeHeading";
import { ProfileView } from "../../views/ProfileView";
import { ResumeHeadingEditor } from "./ResumeHeadingEditor";
import { ResumeSectionsPanel } from "./ResumeSectionsPanel";

type MockStoreState = {
  workspace: { profiles: unknown[]; applications: unknown[] };
  selectedProfileId: string | undefined;
  saveProfile: ReturnType<typeof vi.fn>;
  removeProfile: ReturnType<typeof vi.fn>;
  selectProfile: ReturnType<typeof vi.fn>;
  selectedApplicationId: string | undefined;
};
const mockedStore = vi.hoisted(() => ({ state: undefined as MockStoreState | undefined }));
vi.mock("../../store/useAppStore", () => ({
  useAppStore: Object.assign((selector: (state: MockStoreState) => unknown) => selector(mockedStore.state!), {
    getState: () => mockedStore.state,
  }),
}));

const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(),
    isDefault: true,
    firstName: "Mustafa",
    lastName: "Özdemir",
    title: "Softwareentwickler",
    updatedAt: new Date().toISOString(),
    ...extra,
  });
const dom = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const noop = () => undefined;

describe("ResumeHeadingEditor", () => {
  it("offers the four presentations with Lebenslauf selected by default and a live preview", () => {
    const document = dom(renderToStaticMarkup(<ResumeHeadingEditor profile={profile()} onChange={noop} />));
    const labels = Array.from(document.querySelectorAll(".resume-heading-option")).map((node) => node.textContent);
    expect(labels).toEqual(["Lebenslauf", "Lebenslauf + Name", "Curriculum Vitae", "Benutzerdefiniert"]);
    expect(document.querySelector(".resume-heading-option.is-selected")?.textContent).toBe("Lebenslauf");
    expect(document.querySelector(".resume-heading-preview strong")?.textContent).toBe("Lebenslauf");
    expect(document.querySelector(".resume-heading-preview")?.textContent).toContain("Name und Berufsbezeichnung werden aus den Profildaten übernommen.");
    expect(document.body.textContent).not.toContain("Eigene Überschrift");
  });

  it("previews Lebenslauf + Name with the current name", () => {
    const withName = setResumeHeading(profile(), { mode: "with-name" });
    const html = renderToStaticMarkup(<ResumeHeadingEditor profile={withName} onChange={noop} />);
    expect(dom(html).querySelector(".resume-heading-preview strong")?.textContent).toBe("Lebenslauf Mustafa Özdemir");
    expect(dom(renderToStaticMarkup(<ResumeHeadingEditor profile={{ ...withName, lastName: "Yılmaz" }} onChange={noop} />))
      .querySelector(".resume-heading-preview strong")?.textContent).toBe("Lebenslauf Mustafa Yılmaz");
  });

  it("shows the custom input only for Benutzerdefiniert and flags an empty text", () => {
    const empty = dom(renderToStaticMarkup(<ResumeHeadingEditor profile={setResumeHeading(profile(), { mode: "custom" })} onChange={noop} />));
    expect(empty.body.textContent).toContain("Eigene Überschrift");
    expect(empty.querySelector('input[aria-invalid="true"]')).not.toBeNull();
    expect(empty.querySelector('[role="alert"]')?.textContent).toContain("darf nicht leer sein");
    expect(empty.querySelector(".resume-heading-preview strong")?.textContent).toBe("Lebenslauf");

    const filled = dom(renderToStaticMarkup(<ResumeHeadingEditor profile={setResumeHeading(profile(), { mode: "custom", customTitle: "Mein Lebenslauf" })} onChange={noop} />));
    expect(filled.querySelector('input[placeholder="Mein Lebenslauf"]')?.getAttribute("value")).toBe("Mein Lebenslauf");
    expect(filled.querySelector('[role="alert"]')).toBeNull();
    expect(filled.querySelector(".resume-heading-preview strong")?.textContent).toBe("Mein Lebenslauf");
  });

  it("has a compact variant without a second full editor", () => {
    const document = dom(renderToStaticMarkup(<ResumeHeadingEditor variant="compact" profile={setResumeHeading(profile(), { mode: "with-name" })} onChange={noop} />));
    expect(document.querySelector('select[aria-label="Überschrift Darstellung"]')).not.toBeNull();
    expect(document.querySelectorAll("option")).toHaveLength(4);
    expect(document.querySelector(".resume-heading-preview")).toBeNull();
    expect(document.body.textContent).toContain("Lebenslauf Mustafa Özdemir");
    expect(Array.from(document.querySelectorAll("label > span")).map((node) => node.textContent)).toEqual(["Überschrift"]);
  });
});

describe("ResumeSectionsPanel Überschrift card", () => {
  const panel = (source = profile()) => dom(renderToStaticMarkup(
    <ResumeSectionsPanel profile={source} templateId="modern" singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()} initialExpanded="heading" />,
  ));

  it("manages the Lebenslauf-Überschrift and no longer repeats the profile's name fields", () => {
    const document = panel();
    const card = Array.from(document.querySelectorAll("article.manager-card")).find((node) => node.querySelector(".manager-card-title")?.textContent?.trim() === "Überschrift")!;
    expect(card).toBeDefined();
    expect(card.querySelector('select[aria-label="Überschrift Darstellung"]')).not.toBeNull();
    // No Vorname/Nachname/Berufsbezeichnung editor: the card holds one select, no text input.
    expect(card.querySelectorAll("input")).toHaveLength(0);
    expect(Array.from(card.querySelectorAll("label > span")).map((node) => node.textContent)).toEqual(["Überschrift"]);
    expect(card.textContent).not.toContain("Vorname");
    expect(document.body.textContent).not.toContain("Lebenslauf-Kopf");
  });

  it("marks the Überschrift as Pflicht and offers no way to hide it", () => {
    const document = panel();
    const card = Array.from(document.querySelectorAll("article.manager-card")).find((node) => node.querySelector(".manager-card-title")?.textContent?.trim() === "Überschrift")!;
    expect(card.querySelector(".manager-required-badge")?.textContent).toBe("Pflicht");
    expect(card.querySelector('[aria-label="Überschrift ausblenden"],[aria-label="Überschrift anzeigen"]')).toBeNull();
    // The other fixed sections keep their visibility switch.
    expect(document.querySelector('[aria-label="Persönliche Daten ausblenden"]')).not.toBeNull();
  });

  it("keeps the Überschrift visible although an older save hid it", () => {
    const hidden = profile({ resumeSemanticSections: [{ semanticType: "heading", customTitle: "", visible: false, enabled: false, order: 0 }] });
    const document = panel(hidden);
    const hiddenCards = Array.from(document.querySelectorAll("article.manager-card.is-hidden .manager-card-title")).map((node) => node.textContent?.trim());
    expect(hiddenCards).not.toContain("Überschrift");
    expect(document.querySelectorAll("article.manager-card")).not.toHaveLength(0);
  });
});

describe("ProfileView 1. Überschrift", () => {
  it("is the first Lebenslauf-Stammdaten section, marked Pflicht, with Lebenslauf as the default", () => {
    mockedStore.state = {
      workspace: { profiles: [], applications: [] }, selectedProfileId: undefined, selectedApplicationId: undefined,
      saveProfile: vi.fn(), removeProfile: vi.fn(), selectProfile: vi.fn(),
    };
    const document = dom(renderToStaticMarkup(<ProfileView onSaved={noop} />));
    const sections = Array.from(document.querySelectorAll("form > section.profile-editor-section"));
    const first = sections[0];
    expect(first.querySelector("h3")?.textContent).toBe("1. Überschrift");
    expect(first.textContent).toContain("Titel des Lebenslaufs. Wird im Lebenslauf und auf Folgeseiten verwendet.");
    expect(first.querySelector(".profile-required-badge")?.textContent).toBe("Pflicht");
    expect(first.querySelector(".resume-heading-option.is-selected")?.textContent).toBe("Lebenslauf");
    expect(first.querySelector(".resume-heading-preview strong")?.textContent).toBe("Lebenslauf");
    expect(sections[1].querySelector("h3")?.textContent).toBe("2. Persönliche Daten");
    // Name and Berufsbezeichnung stay in the personal data section.
    expect(first.textContent).not.toContain("Berufsbezeichnung *");
    expect(sections[1].textContent).toContain("Berufsbezeichnung");
  });
});
