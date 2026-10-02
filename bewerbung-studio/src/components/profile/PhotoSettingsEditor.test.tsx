import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { profileSchema, type ApplicantProfile } from "../../shared/schema";
import { setResumePhotoSize, setResumePhotoVisible } from "../../shared/resumePhoto";
import { ProfileView } from "../../views/ProfileView";
import { PhotoSettingsEditor, photoTips } from "./PhotoSettingsEditor";

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

const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Mustafa", lastName: "Özdemir", photoPath: photo,
    updatedAt: new Date().toISOString(), ...extra,
  });
const dom = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const noop = () => undefined;
const editor = (source: ApplicantProfile, fileName?: string) =>
  dom(renderToStaticMarkup(<PhotoSettingsEditor profile={source} onChange={noop} fileName={fileName} onPick={noop} onRemove={noop} />));
const radios = (document: Document) => Array.from(document.querySelectorAll('input[type="radio"]'));

describe("3. Bewerbungsfoto editor", () => {
  it("asks for a photo while there is none and offers nothing that needs one", () => {
    const document = editor(profile({ photoPath: "" }));
    expect(document.body.textContent).toContain("Noch kein Bewerbungsfoto ausgewählt.");
    const buttons = Array.from(document.querySelectorAll("button")).map((node) => node.textContent?.trim());
    expect(buttons).toEqual(["Foto auswählen"]);
    expect(document.querySelector(".profile-media-preview img")).toBeNull();
    for (const input of [...radios(document), document.querySelector('input[type="checkbox"]')!]) expect(input.hasAttribute("disabled")).toBe(true);
  });

  it("shows the picture with the buttons to replace and remove it", () => {
    const document = editor(profile(), "bewerbungsfoto.jpg");
    expect(document.querySelector(".profile-media-preview img")?.getAttribute("src")).toBe(photo);
    expect(Array.from(document.querySelectorAll("button")).map((node) => node.textContent?.trim())).toEqual(["Foto ersetzen", "Foto entfernen"]);
    expect(document.body.textContent).toContain("Datei: bewerbungsfoto.jpg");
    expect(document.body.textContent).toContain("PNG, JPG oder WebP · maximal 8 MB");
    expect(document.body.textContent).not.toContain("Noch kein Bewerbungsfoto");
  });

  it("offers exactly the three steps Klein / Mittel / Groß as a choice, with Mittel for an older profile", () => {
    const document = editor(profile());
    expect(radios(document).map((input) => input.getAttribute("value"))).toEqual(["small", "medium", "large"]);
    expect(Array.from(document.querySelectorAll(".photo-size-option")).map((node) => node.textContent)).toEqual(["Klein", "Mittel", "Groß"]);
    expect(radios(document).filter((input) => input.hasAttribute("checked")).map((input) => input.getAttribute("value"))).toEqual(["medium"]);
    expect(radios(document).every((input) => !input.hasAttribute("disabled"))).toBe(true);
    // No free number, millimetre field or slider.
    expect(document.querySelector('input[type="range"], input[type="number"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\bmm\b/);
  });

  it("selects the size the profile holds", () => {
    for (const size of ["small", "large"] as const) {
      const checked = radios(editor(setResumePhotoSize(profile(), size))).filter((input) => input.hasAttribute("checked"));
      expect(checked.map((input) => input.getAttribute("value"))).toEqual([size]);
    }
  });

  it("explains what Mittel means", () => {
    expect(editor(profile()).body.textContent).toContain("„Mittel“ entspricht der Originalgröße der gewählten Vorlage.");
  });

  it("uses the semantic photo visibility: off for an older profile, on after it is switched on", () => {
    const checkbox = (source: ApplicantProfile) => editor(source).querySelector('input[type="checkbox"]')!;
    expect(editor(profile()).querySelector(".photo-visibility")?.textContent).toBe("Im Lebenslauf anzeigen");
    expect(checkbox(profile()).hasAttribute("checked")).toBe(false);
    expect(checkbox(setResumePhotoVisible(profile(), true)).hasAttribute("checked")).toBe(true);
    expect(checkbox(setResumePhotoVisible(setResumePhotoVisible(profile(), true), false)).hasAttribute("checked")).toBe(false);
  });

  it("gives a short German note on how the photo should look", () => {
    const note = editor(profile()).querySelector(".photo-tips")!;
    expect(note.querySelector("strong")?.textContent?.trim()).toBe("So sollte Ihr Foto aussehen");
    expect(Array.from(note.querySelectorAll("li")).map((node) => node.textContent)).toEqual([...photoTips]);
    expect(photoTips.length).toBeLessThanOrEqual(4);
    expect(note.textContent).toContain("Ein Foto ist freiwillig.");
    expect(note.textContent).toContain("ATS");
  });

  it("does not repeat the design controls of the Lebenslauf or the Unterschrift", () => {
    const document = editor(profile({ signaturePath: photo }));
    for (const text of ["Rund", "Eckig", "Abgerundet", "Fotolinien", "Foto-Layout", "Unterschrift"]) expect(document.body.textContent, text).not.toContain(text);
  });
});

describe("Profil → 3. Bewerbungsfoto", () => {
  const view = (source?: ApplicantProfile) => {
    mockedStore.state = {
      workspace: { profiles: source ? [source] : [], applications: [] }, selectedProfileId: source?.id, selectedApplicationId: undefined,
      saveProfile: vi.fn(), removeProfile: vi.fn(), selectProfile: vi.fn(),
    };
    return dom(renderToStaticMarkup(<ProfileView onSaved={noop} />));
  };
  const sections = (document: Document) => Array.from(document.querySelectorAll("form > section.profile-editor-section"));
  const title = (section: Element) => section.querySelector("h3")?.textContent;

  it("is the third section, after the Persönliche Daten, and marked Optional", () => {
    const list = sections(view());
    expect(list.slice(0, 4).map(title)).toEqual(["1. Überschrift", "2. Persönliche Daten", "3. Bewerbungsfoto", "4. Kurzprofil"]);
    expect(list[2].querySelector(".profile-optional-badge")?.textContent).toBe("Optional");
    expect(list[2].textContent).toContain("Ein professionelles Bewerbungsfoto kann den persönlichen Eindruck unterstützen.");
    expect(list.map(title)).not.toContain("Bewerbungsfoto & Unterschrift");
  });

  it("no longer carries the Unterschrift; the signature stays editable with the closing", () => {
    const list = sections(view(profile({ signaturePath: photo })));
    const photoSection = list.find((section) => title(section) === "3. Bewerbungsfoto")!;
    expect(photoSection.textContent).not.toContain("Unterschrift");
    // The section that holds the signature (its number and title belong to the closing task).
    const closing = list.find((section) => section.querySelector(".media-signature"))!;
    expect(closing.querySelector(".media-signature img")?.getAttribute("src")).toBe(photo);
    expect(closing.textContent).toContain("Unterschrift");
    expect(closing.textContent).toContain("transparentem Hintergrund");
  });

  it("opens an older profile with its photo, Mittel and not yet shown in the Lebenslauf", () => {
    const section = sections(view(profile())).find((item) => title(item) === "3. Bewerbungsfoto")!;
    expect(section.querySelector(".profile-media-preview img")?.getAttribute("src")).toBe(photo);
    expect(section.querySelector('input[type="radio"][checked]')?.getAttribute("value")).toBe("medium");
    expect(section.querySelector('input[type="checkbox"]')?.hasAttribute("checked")).toBe(false);
  });
});
