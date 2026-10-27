import { act, createElement } from "react";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTemplateDocumentDesignDefaults } from "../shared/cvDesign";
import { applicationSchema, defaultSettings, profileSchema, type ApplicantProfile, type Application } from "../shared/schema";
import { DocumentsView } from "./DocumentsView";

/** The app store as DocumentsView reads it: the workspace and the save actions, which write back into it. */
const testStore = vi.hoisted(() => ({ state: undefined as Record<string, unknown> | undefined }));
vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: Record<string, unknown>) => unknown) => selector(testStore.state ?? {});
  useAppStore.getState = () => testStore.state;
  return { useAppStore, selectCurrentApplication: (state: { workspace: { applications: unknown[] } }) => state.workspace.applications[0] };
});

const now = "2026-10-14T10:00:00.000Z";
const uid = (n: number) => `7d000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** Two fictional profiles: the Bewerbung uses the first one. */
const makeProfile = (n: number, summary: string) => profileSchema.parse({
  id: uid(n), isDefault: n === 1, firstName: n === 1 ? "Mina" : "Lena", lastName: "Kaya", city: "Berlin", email: `person${n}@example.com`,
  updatedAt: now, summary,
  experiences: [{ id: uid(n * 10 + 1), from: "2020", to: "2022", role: "Planerin", company: "Muster GmbH", tasks: ["Planung"], achievements: [] }],
  education: [{ id: uid(n * 10 + 2), from: "2014", to: "2018", degree: "Bachelor", institution: "Muster Hochschule" }],
});
const makeApplication = (profileId: string) => applicationSchema.parse({
  schemaVersion: 1, id: uid(100), profileId, folderName: "Test", company: { name: "Beispiel GmbH", city: "Berlin" }, contact: {},
  job: { title: "Planung" }, status: "Entwurf", templateId: "zweispaltig", accentColor: "#123456", secondaryColor: "#234567",
  designSettings: getTemplateDocumentDesignDefaults("zweispaltig"), documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
});

const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
const previousFormData = globalThis.FormData;
afterEach(() => {
  Object.assign(globalThis, { window: previousWindow, document: previousDocument, FormData: previousFormData });
  testStore.state = undefined;
});

/** DocumentsView on the Lebenslauf tab in a real React tree, with a store whose saves can fail. */
const mount = async (profiles: ApplicantProfile[], options: { failSave?: () => boolean } = {}) => {
  const saveProfile = vi.fn(async (profile: ApplicantProfile) => {
    if (options.failSave?.()) throw new Error("Datenträger nicht erreichbar");
    const workspace = testStore.state!.workspace as { profiles: ApplicantProfile[] };
    testStore.state = { ...testStore.state, workspace: { ...workspace, profiles: workspace.profiles.map((item) => (item.id === profile.id ? profile : item)) } };
  });
  const saveApplication = vi.fn(async (_application: Application) => undefined);
  testStore.state = {
    workspace: { schemaVersion: 1, applications: [makeApplication(profiles[0]!.id)], profiles, events: [], attachments: [], todos: [],
      customCvDesigns: [], settings: defaultSettings, updatedAt: now },
    saveProfile, saveApplication, saveResumeDesign: vi.fn(async () => undefined), syncCoverLetter: vi.fn(async () => undefined),
    selectProfile: vi.fn(), exportPdf: vi.fn(), openFolder: vi.fn(), saveCustomCvDesign: vi.fn(), removeCustomCvDesign: vi.fn(),
  };
  const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
  Object.assign(window.document, { oninput: null });
  // What a browser has and linkedom lacks: the view measures its panes and the preview.
  class NoResize { observe() {} unobserve() {} disconnect() {} }
  Object.assign(window, { ResizeObserver: NoResize, requestAnimationFrame: (callback: () => void) => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => "", paddingTop: "0px", paddingBottom: "0px", fontSize: "16px" }) });
  Object.assign(window.HTMLElement.prototype, { scrollTo() {}, scrollIntoView() {} });
  Object.assign(Object.getPrototypeOf(window.document.createElement("form")), { requestSubmit(this: Element) {
    this.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  } });
  // A textarea's default value is its text, as in a browser (React writes the first value there).
  Object.defineProperty(window.HTMLTextAreaElement.prototype, "defaultValue", { configurable: true,
    get(this: Element) { return this.textContent ?? ""; }, set(this: Element, value: string) { this.textContent = value; } });
  /** The form fields by name, as the browser's FormData reads them. */
  class FormFields {
    private readonly values = new Map<string, string>();
    constructor(form?: Element) {
      for (const field of Array.from(form?.querySelectorAll("[name]") ?? []))
        this.values.set(field.getAttribute("name")!, (field as HTMLInputElement).value ?? "");
    }
    get(name: string) { return this.values.get(name) ?? null; }
    has(name: string) { return this.values.has(name); }
  }
  Object.assign(globalThis, { window, document: window.document, ResizeObserver: NoResize, IS_REACT_ACT_ENVIRONMENT: true, FormData: FormFields,
    HTMLElement: window.HTMLElement, HTMLInputElement: window.HTMLInputElement, HTMLTextAreaElement: window.HTMLTextAreaElement });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(window.document.getElementById("root")!);
  const render = () => act(async () => { root.render(createElement(DocumentsView, { initialTab: "lebenslauf" })); });
  await render();
  const query = <T extends Element>(selector: string) => window.document.querySelector<T>(selector);
  const fire = (target: Element, type: string) => act(async () => { target.dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true })); });
  const button = (text: string, scope = "body") => Array.from(window.document.querySelectorAll(`${scope} button`)).find((node) => node.textContent?.trim() === text)!;
  return {
    saveProfile,
    saveApplication,
    query,
    rerender: render,
    status: () => query(".resume-save-status")?.textContent?.trim(),
    stickyStatus: () => query(".scroll-jump__status")?.textContent?.trim(),
    summaryField: () => query<HTMLTextAreaElement>(".summary-editor textarea"),
    open: (title: string) => fire(Array.from(window.document.querySelectorAll(".manager-card-title")).find((node) => node.textContent?.trim() === title)!, "click"),
    type: async (element: HTMLTextAreaElement, value: string) => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")!.set!.call(element, value);
      await act(async () => { element.dispatchEvent(new window.Event("input", { bubbles: true })); });
    },
    press: (text: string, scope?: string) => fire(button(text, scope), "click"),
    /** Strg+S saves the Lebenslauf: it submits the editor form. */
    save: () => act(async () => {
      window.dispatchEvent(Object.assign(new window.Event("keydown", { bubbles: true, cancelable: true }), { key: "s", ctrlKey: true }));
    }),
    unmount: () => act(async () => root.unmount()),
  };
};

describe("Lebenslauf content edits the profile of the Bewerbung", () => {
  it("recalculates the requirement score after saved application and bound profile changes", async () => {
    const first = profileSchema.parse({ ...makeProfile(1, "Fiktives Profil"), skills: ["TypeScript"] });
    const second = profileSchema.parse({ ...makeProfile(2, "Anderes Profil"), skills: ["SQL"] });
    const view = await mount([first, second]);
    const workspace = testStore.state!.workspace as { applications: Application[]; profiles: ApplicantProfile[] };
    testStore.state = { ...testStore.state, workspace: {
      ...workspace, applications: [{ ...workspace.applications[0], job: {
        ...workspace.applications[0].job, tasksText: "React", requirementsText: "TypeScript und SQL",
      } }],
    } };
    await view.rerender();
    expect(view.query(".match-analysis")?.textContent).toContain("50%");
    expect(view.query(".match-analysis")?.textContent).toContain("Nicht nachgewiesene Anforderungen");
    testStore.state = { ...testStore.state, workspace: {
      ...(testStore.state!.workspace as object), profiles: [
        { ...first, skills: ["TypeScript", "SQL"], updatedAt: "2026-10-14T11:00:00.000Z" }, second,
      ],
    } };
    await view.rerender();
    expect(view.query(".match-analysis")?.textContent).toContain("100%");
    await view.unmount();
  });
  it("shows an edit as unsaved, saves it into the bound profile only, and keeps it after reopening", async () => {
    const view = await mount([makeProfile(1, "Alter fiktiver Text."), makeProfile(2, "Anderes Profil.")]);
    await view.open("Kurzprofil");
    expect(view.summaryField()!.value).toBe("Alter fiktiver Text.");
    await view.type(view.summaryField()!, "Neuer fiktiver Text.");
    expect(view.status()).toBe("Ungespeicherte Änderungen");
    expect(view.stickyStatus()).toBe("Ungespeicherte Änderungen");
    await view.save();
    expect(view.saveProfile).toHaveBeenCalledTimes(1);
    expect(view.saveProfile.mock.calls[0]![0]).toMatchObject({ id: uid(1), summary: "Neuer fiktiver Text." });
    const profiles = (testStore.state!.workspace as { profiles: ApplicantProfile[] }).profiles;
    expect(profiles.find((item) => item.id === uid(2))!.summary).toBe("Anderes Profil.");
    expect(view.status()).toBe("Gespeichert");
    await view.unmount();
    // Reopened from the saved workspace (as after a restart): the Lebenslauf shows the saved text.
    const reopened = await mount((testStore.state!.workspace as { profiles: ApplicantProfile[] }).profiles);
    await reopened.open("Kurzprofil");
    expect(reopened.summaryField()!.value).toBe("Neuer fiktiver Text.");
    await reopened.unmount();
  });

  it("keeps the user's input when saving fails and says so", async () => {
    let fail = true;
    const view = await mount([makeProfile(1, "Alter fiktiver Text.")], { failSave: () => fail });
    await view.open("Kurzprofil");
    await view.type(view.summaryField()!, "Nicht verlieren.");
    await view.save();
    expect(view.stickyStatus()).toBe("Fehler beim Speichern");
    expect(view.query("[role=alert]")?.textContent).toContain("Datenträger nicht erreichbar");
    expect(view.summaryField()!.value).toBe("Nicht verlieren.");
    fail = false;
    await view.save();
    expect(view.saveProfile.mock.calls.at(-1)![0]).toMatchObject({ summary: "Nicht verlieren." });
    await view.unmount();
  });

  it("Verwerfen drops only what is not saved yet", async () => {
    const view = await mount([makeProfile(1, "Gespeicherter Text.")]);
    await view.open("Kurzprofil");
    await view.type(view.summaryField()!, "Nur ein Entwurf.");
    await view.press("Verwerfen", ".resume-section-actions");
    expect(view.summaryField()!.value).toBe("Gespeicherter Text.");
    expect(view.status()).toBe("Profil verbunden");
    expect(view.stickyStatus()).toBe("Keine ungespeicherten Änderungen");
    expect(view.query(".scroll-jump .button.is-dirty")).toBeNull();
    expect(view.saveProfile).not.toHaveBeenCalled();
    await view.unmount();
  });

  it("shows what the Profil saves meanwhile without losing the open edit", async () => {
    const view = await mount([makeProfile(1, "Alter fiktiver Text.")]);
    await view.open("Kurzprofil");
    await view.type(view.summaryField()!, "Entwurf im Lebenslauf.");
    // The Profil screen saves a new station of the same profile.
    const workspace = testStore.state!.workspace as { profiles: ApplicantProfile[] };
    const fromProfil = profileSchema.parse({ ...workspace.profiles[0], updatedAt: "2026-10-14T11:00:00.000Z",
      experiences: [...workspace.profiles[0]!.experiences, { id: uid(19), from: "2023", to: "", role: "Leiterin", company: "Neue GmbH", achievements: [] }] });
    testStore.state = { ...testStore.state, workspace: { ...workspace, profiles: [fromProfil] } };
    await view.rerender();
    expect(view.summaryField()!.value).toBe("Entwurf im Lebenslauf.");
    await view.save();
    const saved = view.saveProfile.mock.calls.at(-1)![0];
    expect(saved.summary).toBe("Entwurf im Lebenslauf.");
    // The station saved in the Profil is not overwritten by the older draft.
    expect(saved.experiences.map((item) => item.company)).toEqual(["Muster GmbH", "Neue GmbH"]);
    await view.unmount();
  });
});
