import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getManagerSections } from "../features/resume-sections/resume-manager";
import { ResumeSectionsPanel } from "../components/resume/ResumeSectionsPanel";
import { createResumeSpecialSection, resumeSpecialSectionCatalog } from "../shared/resumeSpecialSectionCatalog";
import { profileSchema, type ApplicantProfile } from "../shared/schema";
import { ProfileView } from "./ProfileView";

type MockStoreState = {
  workspace: { profiles: unknown[]; applications: unknown[] };
  selectedProfileId: string | undefined;
  selectedApplicationId: string | undefined;
  saveProfile: ReturnType<typeof vi.fn>;
  removeProfile: ReturnType<typeof vi.fn>;
  selectProfile: ReturnType<typeof vi.fn>;
};
const mockedStore = vi.hoisted(() => ({ state: undefined as MockStoreState | undefined }));
vi.mock("../store/useAppStore", () => ({
  useAppStore: Object.assign((selector: (state: MockStoreState) => unknown) => selector(mockedStore.state!), {
    getState: () => mockedStore.state,
  }),
}));

const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Mustafa", lastName: "Özdemir",
    street: "Musterstraße 10", postalCode: "12345", city: "Stuttgart", phone: "+49 170 1234567", email: "mustafa@example.com",
    updatedAt: new Date().toISOString(), ...extra,
  });
const useProfile = (source: ApplicantProfile) => {
  mockedStore.state = {
    workspace: { profiles: [source], applications: [] }, selectedProfileId: source.id, selectedApplicationId: undefined,
    saveProfile: vi.fn(async () => undefined), removeProfile: vi.fn(), selectProfile: vi.fn(),
  };
  return mockedStore.state;
};
const noop = () => undefined;
const specialSection = (root: ParentNode) =>
  Array.from(root.querySelectorAll("section.profile-editor-section"))
    .find((section) => section.querySelector("h3")?.textContent === "Besondere Lebenslauf-Bereiche")!;
const pickerLabels = (root: ParentNode) =>
  Array.from(root.querySelectorAll(".special-section-picker .special-section-option span"), (node) => node.textContent);

describe("Profil → Besondere Lebenslauf-Bereiche", () => {
  it("uses the same picker and the same 13 Bereiche as the Lebenslauf manager", () => {
    const source = profile({ specialSections: [createResumeSpecialSection("projects")] });
    useProfile(source);
    const { document } = parseHTML(`<html><body>${renderToStaticMarkup(<ProfileView onSaved={noop} />)}</body></html>`);
    const section = specialSection(document);
    expect(section.querySelectorAll(".special-section-picker")).toHaveLength(1);
    expect(section.querySelector(".special-section-picker select")).toBeNull();
    expect(pickerLabels(section)).toEqual(resumeSpecialSectionCatalog.map((entry) => entry.label));
    expect(section.querySelector('.special-section-option[data-kind="projects"]')?.hasAttribute("disabled")).toBe(true);

    const manager = parseHTML(`<html><body>${renderToStaticMarkup(
      <ResumeSectionsPanel profile={source} templateId="modern" singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()} />,
    )}</body></html>`).document;
    expect(pickerLabels(manager)).toEqual(pickerLabels(section));
    expect(manager.querySelector('.special-section-option[data-kind="projects"]')?.hasAttribute("disabled")).toBe(true);
  });
});

const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
const previousActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
afterEach(() => {
  Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: previousActEnvironment });
});

describe("Profil → Besondere Lebenslauf-Bereiche in a real React tree", () => {
  it("adds a Bereich with the picker, keeps the editing controls and saves it for the Lebenslauf manager", async () => {
    const existing = { ...createResumeSpecialSection("references"), title: "Referenzen (auf Anfrage)" };
    const source = profile({ specialSections: [existing] });
    const store = useProfile(source);
    const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(window.document.getElementById("root")!);
    await act(async () => { root.render(<ProfileView onSaved={noop} />); });
    const section = () => specialSection(window.document);
    const press = (text: string) => act(async () => {
      Array.from(section().querySelectorAll("button")).find((button) => button.textContent?.trim() === text)!
        .dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    });

    await press("Referenzen");
    await press("Bereich hinzufügen");
    const cards = Array.from(section().querySelectorAll(".special-section-card"));
    expect(cards).toHaveLength(2);
    expect((cards[0]!.querySelector("input") as HTMLInputElement).value).toBe("Referenzen (auf Anfrage)");
    const added = cards[1]!;
    expect((added.querySelector("input") as HTMLInputElement).value).toBe("Referenzen");
    // Überschrift, Inhaltstyp, Bereichstyp, Anzeigen, move and delete are still the card's own controls.
    expect(Array.from(added.querySelectorAll(".field > span"), (node) => node.textContent)).toEqual(["Überschrift im Lebenslauf", "Inhaltstyp", "Bereichstyp"]);
    expect(Array.from(added.querySelectorAll("select")[1]!.querySelectorAll("option"), (node) => node.textContent))
      .toEqual(resumeSpecialSectionCatalog.map((entry) => entry.label));
    expect(added.textContent).toContain("Anzeigen");
    for (const label of ["Bereich nach oben verschieben", "Bereich nach unten verschieben", "Bereich löschen"])
      expect(added.querySelector(`[aria-label="${label}"]`)).not.toBeNull();

    await press("Abschnitt aktualisieren");
    expect(store.saveProfile).toHaveBeenCalledTimes(1);
    const saved = store.saveProfile.mock.calls[0]![0] as ApplicantProfile;
    expect(saved.specialSections).toHaveLength(2);
    expect(saved.specialSections[0]).toEqual(existing);
    expect(saved.specialSections[1]).toMatchObject({ kind: "references", title: "Referenzen", isVisible: true, entries: [] });
    expect(getManagerSections(saved, "modern").find((entry) => entry.id === `special:${saved.specialSections[1]!.id}`))
      .toMatchObject({ title: "Referenzen", visible: true });
    await act(async () => root.unmount());
  });
});
