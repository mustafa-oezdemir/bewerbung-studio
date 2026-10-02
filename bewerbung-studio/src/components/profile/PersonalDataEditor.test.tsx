import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { getManagerSections, setPersonalDataTitle } from "../../features/resume-sections/resume-manager";
import { getResumeSemanticTitle } from "../../features/resume-sections/resume-section-system";
import { profileSchema, type ApplicantProfile } from "../../shared/schema";
import { ProfileView } from "../../views/ProfileView";
import { ResumeSectionsPanel } from "../resume/ResumeSectionsPanel";
import { PersonalDataEditor } from "./PersonalDataEditor";

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

const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Mustafa", lastName: "Özdemir",
    street: "Musterstraße 10", postalCode: "12345", city: "Stuttgart", phone: "+49 170 1234567", email: "mustafa@example.com",
    updatedAt: new Date().toISOString(), ...extra,
  });
const dom = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const noop = () => undefined;
const editor = (source: ApplicantProfile, showIssues = false) =>
  dom(renderToStaticMarkup(<PersonalDataEditor profile={source} onChange={noop} showIssues={showIssues} />));
const labelOf = (document: Document, id: string) => document.querySelector(`label[for="personal-data-${id}"]`)?.textContent?.trim();
const input = (document: Document, id: string) => document.getElementById(`personal-data-${id}`);

describe("Persönliche Daten editor", () => {
  it("separates Pflichtangaben, beruflichen Online-Profile and Freiwillige Angaben", () => {
    const document = editor(profile());
    const groups = Array.from(document.querySelectorAll("section.personal-group")).map((group) => ({
      title: group.querySelector("h4")?.textContent,
      badge: group.querySelector(".profile-required-badge, .profile-optional-badge")?.textContent,
    }));
    expect(groups).toEqual([
      { title: "Pflichtangaben", badge: "Pflicht" },
      { title: "Berufliche Online-Profile", badge: "Optional" },
      { title: "Freiwillige Angaben", badge: "Optional" },
    ]);
  });

  it("asks for every Pflichtangabe with the specified label and input semantics", () => {
    const document = editor(profile());
    const required = document.querySelector("section.personal-group");
    const expected: Array<[string, string, string | null]> = [
      ["firstName", "Vorname *", "text"], ["lastName", "Nachname *", "text"], ["street", "Straße und Hausnummer *", "text"],
      ["postalCode", "PLZ *", "text"], ["city", "Ort *", "text"], ["country", "Land *", "text"],
      ["phone", "Telefonnummer *", "tel"], ["email", "E-Mail-Adresse *", "email"],
    ];
    for (const [id, label, type] of expected) {
      expect(labelOf(document, id), id).toBe(label);
      expect(input(document, id)?.getAttribute("type"), id).toBe(type);
      expect(input(document, id)?.getAttribute("aria-required"), id).toBe("true");
      expect(required?.contains(input(document, id) as Node), id).toBe(true);
    }
    expect(document.getElementById("personal-data-phone-hint")?.textContent).toBe("Für internationale Bewerbungen mit Ländervorwahl, z. B. +49 170 1234567.");
    expect(document.querySelector(".personal-completeness")?.textContent).toBe("8 von 8 vollständig");
  });

  it("keeps the existing profile fields as the only data: values come from and go to the profile", () => {
    const document = editor(profile({ linkedin: "linkedin.com/in/test", github: "github.com/test", portfolio: "example.com", birthPlace: "Gerze", nationality: "deutsch", children: "2" }));
    expect(input(document, "firstName")?.getAttribute("value")).toBe("Mustafa");
    expect(input(document, "street")?.getAttribute("value")).toBe("Musterstraße 10");
    expect(input(document, "linkedin")?.getAttribute("value")).toBe("linkedin.com/in/test");
    expect(input(document, "portfolio")?.getAttribute("value")).toBe("example.com");
    expect(input(document, "birthPlace")?.getAttribute("value")).toBe("Gerze");
    expect(input(document, "nationality")?.getAttribute("placeholder")).toBe("z. B. deutsch");
    expect(input(document, "children")?.getAttribute("value")).toBe("2");
    expect(input(document, "title")).not.toBeNull();
    expect(document.querySelector('[id*="fullName"]')).toBeNull();
  });

  it("marks a missing Pflichtangabe of an older profile without blocking it", () => {
    const legacy = profile({ phone: "", street: "" });
    const hidden = editor(legacy, false);
    expect(hidden.querySelectorAll(".field-issue")).toHaveLength(0);
    const shown = editor(legacy, true);
    expect(Array.from(shown.querySelectorAll(".field-issue")).map((node) => node.textContent?.trim())).toEqual(["Pflichtangabe fehlt", "Pflichtangabe fehlt"]);
    expect(input(shown, "phone")?.getAttribute("aria-invalid")).toBe("true");
    expect(input(shown, "street")?.getAttribute("aria-invalid")).toBe("true");
    expect(input(shown, "city")?.getAttribute("aria-invalid")).toBeNull();
    expect(shown.querySelector(".personal-completeness")?.textContent).toBe("6 von 8 vollständig");
  });

  it("explains an invalid e-mail inline instead of alerting", () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    const document = editor(profile({ email: "" }), true);
    expect(document.querySelector("#personal-data-email-issue")?.textContent?.trim()).toBe("Pflichtangabe fehlt");
    const invalid = editor({ ...profile(), email: "mustafa@" }, true);
    expect(invalid.querySelector("#personal-data-email-issue")?.textContent?.trim()).toBe("Bitte eine gültige E-Mail-Adresse eingeben.");
    expect(input(invalid, "email")?.getAttribute("aria-describedby")).toContain("personal-data-email-issue");
    expect(alert).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("keeps URLs, further profiles and the platform list free", () => {
    const document = editor(profile({ onlineProfiles: [{ id: crypto.randomUUID(), label: "Behance", url: "behance.net/test" }] }));
    expect(document.body.textContent).toContain("Online-Profil hinzufügen");
    expect(document.querySelector('input[placeholder="z. B. Xing"]')?.getAttribute("value")).toBe("Behance");
    // Suggestions only: any text is accepted as a platform name.
    expect(document.querySelectorAll("datalist option").length).toBeGreaterThan(3);
    expect(document.querySelector('input[list]')?.getAttribute("type")).toBeNull();
  });

  it("offers controlled Familienstand choices and keeps an older free text", () => {
    const standard = editor(profile({ familyStatus: "Verheiratet" }));
    const select = input(standard, "familyStatus")!;
    expect(Array.from(select.querySelectorAll("option")).map((option) => option.textContent)).toEqual(["Keine Angabe", "Ledig", "Verheiratet", "Geschieden", "Verwitwet"]);
    expect(select.querySelector("option[selected]")?.textContent).toBe("Verheiratet");
    const legacy = editor(profile({ familyStatus: "getrennt lebend" }));
    const options = Array.from(input(legacy, "familyStatus")!.querySelectorAll("option")).map((option) => option.textContent);
    expect(options).toContain("getrennt lebend");
    expect(input(legacy, "familyStatus")!.querySelector("option[selected]")?.textContent).toBe("getrennt lebend");
    expect(editor(profile()).getElementById("personal-data-familyStatus")!.querySelector("option[selected]")?.textContent).toBe("Keine Angabe");
  });
});

describe("Profil → 2. Persönliche Daten", () => {
  const view = (profiles: ApplicantProfile[], selected?: ApplicantProfile) => {
    mockedStore.state = {
      workspace: { profiles, applications: [] }, selectedProfileId: selected?.id, selectedApplicationId: undefined,
      saveProfile: vi.fn(), removeProfile: vi.fn(), selectProfile: vi.fn(),
    };
    return dom(renderToStaticMarkup(<ProfileView onSaved={noop} />));
  };

  it("is the second section, after the Überschrift, marked Pflicht", () => {
    const document = view([]);
    const sections = Array.from(document.querySelectorAll("form > section.profile-editor-section"));
    expect(sections.slice(0, 2).map((section) => section.querySelector("h3")?.textContent)).toEqual(["1. Überschrift", "2. Persönliche Daten"]);
    expect(sections[1].querySelector(".profile-required-badge")?.textContent).toBe("Pflicht");
    expect(sections[1].textContent).toContain("Kontakt- und persönliche Angaben für den Lebenslauf.");
    const form = document.querySelector("form");
    expect(form?.hasAttribute("novalidate") || form?.hasAttribute("noValidate")).toBe(true);
  });

  it("does not shout about a new empty profile, but marks what an existing profile lacks", () => {
    expect(view([]).querySelectorAll(".field-issue")).toHaveLength(0);
    const legacy = profile({ phone: "", street: "", postalCode: "" });
    const existing = view([legacy], legacy);
    expect(existing.querySelectorAll(".field-issue")).toHaveLength(3);
    expect(existing.querySelector(".personal-completeness")?.textContent).toBe("5 von 8 vollständig");
    expect(existing.getElementById("personal-data-firstName")?.getAttribute("value")).toBe("Mustafa");
  });

  it("shares the same personal data editor with the Lebenslauf panel", () => {
    const source = profile();
    const panel = dom(renderToStaticMarkup(
      <ResumeSectionsPanel profile={source} templateId="modern" singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()} initialExpanded="personalData" />,
    ));
    const card = Array.from(panel.querySelectorAll("article.manager-card")).find((node) => node.querySelector(".manager-card-title")?.textContent?.trim() === "Persönliche Daten")!;
    expect(card.querySelector("#personal-data-firstName")).not.toBeNull();
    expect(card.querySelector("#personal-data-email")).not.toBeNull();
    expect(card.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThanOrEqual(12);
  });
});

describe("Persönliche Daten in the Lebenslauf panel", () => {
  const card = (source: ApplicantProfile, title = "Persönliche Daten") => {
    const panel = dom(renderToStaticMarkup(
      <ResumeSectionsPanel profile={source} templateId="modern" singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()} initialExpanded="personalData" />,
    ));
    return Array.from(panel.querySelectorAll("article.manager-card")).find((node) => node.querySelector(".manager-card-title")?.textContent?.trim() === title)!;
  };
  const checkbox = (root: Element, label: string) =>
    Array.from(root.querySelectorAll("label.checkbox-field")).find((node) => node.textContent?.trim() === label)?.querySelector("input");

  it("switches every field separately and keeps Familienstand and Kinder off for an older profile", () => {
    const root = card(profile());
    for (const label of ["Adresse", "Telefon", "E-Mail", "LinkedIn", "GitHub", "Website"]) expect(checkbox(root, label)?.hasAttribute("checked"), label).toBe(true);
    for (const label of ["Geburtsdatum", "Geburtsort", "Staatsangehörigkeit", "Familienstand", "Kinder"]) {
      expect(checkbox(root, label), label).toBeDefined();
      expect(checkbox(root, label)?.hasAttribute("checked"), label).toBe(false);
    }
    expect(Array.from(root.querySelectorAll("legend")).map((node) => node.textContent)).toEqual(["Kontaktdaten", "Kontakt auf Folgeseiten", "Freiwillige Angaben"]);
    expect(checkbox(root, "E-Mail auf Folgeseiten wiederholen")?.hasAttribute("checked")).toBe(false);
    expect(checkbox(root, "Telefon auf Folgeseiten wiederholen")?.hasAttribute("checked")).toBe(false);
  });

  it("answers a switched-off contact detail with a calm note, never a dialog", () => {
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    const off = profile({ resumePersonalFieldVisibility: { phone: false } });
    const root = card(off);
    const notes = Array.from(root.querySelectorAll('p[role="status"]')).map((node) => node.textContent);
    expect(notes).toEqual(["Telefon gehört zu den empfohlenen Kontaktdaten des Lebenslaufs."]);
    expect(alert).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("points to what the profile still lacks for the visible Pflichtangaben", () => {
    const root = card(profile({ phone: "", email: "" }));
    expect(Array.from(root.querySelectorAll('p[role="status"]')).map((node) => node.textContent)).toEqual(["Im Profil fehlen noch: Telefonnummer, E-Mail-Adresse."]);
  });

  it("offers the four section titles; Persönliche Daten stays the default", () => {
    const root = card(profile());
    const select = root.querySelector('select[aria-label="Persönliche Daten Überschrift"]')!;
    expect(Array.from(select.querySelectorAll("option")).map((option) => option.textContent)).toEqual(["Persönliche Daten", "Angaben zur Person", "Persönliche Angaben", "Über mich"]);
    expect(select.querySelector("option[selected]")?.textContent).toBe("Persönliche Daten");
  });

  it("stores the default title as no custom title and keeps a custom one", () => {
    const source = profile();
    expect(getResumeSemanticTitle(source.resumeSemanticSections, "personalData")).toBe("Persönliche Daten");
    const renamed = setPersonalDataTitle(source, "Angaben zur Person");
    expect(getResumeSemanticTitle(renamed.resumeSemanticSections, "personalData")).toBe("Angaben zur Person");
    expect(getManagerSections(renamed, "modern").find((entry) => entry.id === "personalData")?.title).toBe("Angaben zur Person");
    const back = setPersonalDataTitle(renamed, "Persönliche Daten");
    expect(back.resumeSemanticSections.find((section) => section.semanticType === "personalData")?.customTitle).toBe("");
    const legacy = profile({ resumeSemanticSections: [{ semanticType: "personalData", customTitle: "Zur Person", visible: true, enabled: true, order: 1 }] });
    expect(getManagerSections(legacy, "modern").find((entry) => entry.id === "personalData")?.title).toBe("Zur Person");
    expect(card(legacy, "Zur Person")?.querySelector('select[aria-label="Persönliche Daten Überschrift"] option[selected]')?.textContent).toBe("Zur Person");
  });
});
