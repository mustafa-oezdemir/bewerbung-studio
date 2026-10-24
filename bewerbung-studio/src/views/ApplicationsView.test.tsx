import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { defaultDocumentDesign } from "../shared/documentDesign";
import {
  applicationSchema,
  defaultSettings,
  type Workspace,
} from "../shared/schema";
import { ApplicationsView } from "./ApplicationsView";

type MockStoreState = {
  workspace: Workspace;
  selectedApplicationId?: string;
  loading: boolean;
  selectApplication: ReturnType<typeof vi.fn>;
  saveApplication: ReturnType<typeof vi.fn>;
  changeStatus: ReturnType<typeof vi.fn>;
  removeApplication: ReturnType<typeof vi.fn>;
  duplicateApplication: ReturnType<typeof vi.fn>;
  openFolder: ReturnType<typeof vi.fn>;
  exportPdf: ReturnType<typeof vi.fn>;
};

const mockedStore = vi.hoisted(() => ({
  state: undefined as MockStoreState | undefined,
}));

vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: MockStoreState) => unknown) =>
    selector(mockedStore.state!);
  useAppStore.getState = () => mockedStore.state!;
  return {
    useAppStore,
    selectCurrentApplication: (state: MockStoreState) =>
      state.workspace.applications.find(
        (application) => application.id === state.selectedApplicationId,
      ) ?? state.workspace.applications[0],
  };
});

describe("ApplicationsView", () => {
  it("renders one independent save form for every detail section", async () => {
    const now = "2026-08-08T10:00:00.000Z";
    const application = applicationSchema.parse({
      schemaVersion: 1,
      id: "10000000-0000-4000-8000-000000000001",
      folderName: "Beispiel_GmbH_2026-08-08",
      company: {
        name: "Beispiel GmbH",
        city: "Berlin",
      },
      contact: {},
      job: {
        title: "Softwareentwickler",
        fullText: "Alter fiktiver Text",
        tasksText: "Alte Aufgaben",
        requirementsText: "Alte Anforderungen",
      },
      status: "Selbst erstellt",
      templateId: "classic-professional",
      accentColor: "#155e58",
      secondaryColor: "#244766",
      designSettings: defaultDocumentDesign,
      documents: {},
      attachmentIds: [],
      statusHistory: [{ at: now, to: "Selbst erstellt" }],
      createdAt: now,
      updatedAt: now,
    });
    const workspace: Workspace = {
      schemaVersion: 1,
      applications: [application],
      profiles: [],
      events: [],
      attachments: [],
      todos: [],
      customCvDesigns: [],
      settings: defaultSettings,
      updatedAt: now,
    };
    mockedStore.state = {
      workspace,
      selectedApplicationId: application.id,
      loading: false,
      selectApplication: vi.fn(),
      saveApplication: vi.fn(),
      changeStatus: vi.fn(),
      removeApplication: vi.fn(),
      duplicateApplication: vi.fn(),
      openFolder: vi.fn(),
      exportPdf: vi.fn(),
    };

    const markup = renderToStaticMarkup(
      <ApplicationsView onOpenResume={vi.fn()} onOpenCover={vi.fn()} />,
    );

    expect(markup.match(/<form/g)).toHaveLength(5);
    expect(markup.match(/Bereich speichern/g)).toHaveLength(5);
    expect(markup).toContain("Status &amp; Gestaltung");
    expect(markup).toContain("Unternehmen &amp; Position");
    expect(markup).toContain("Ansprechpartner");
    expect(markup).toContain("Anrede / Geschlecht");
    expect(markup).toContain("Zweiten Ansprechpartner hinzufügen");
    expect(markup).toContain("Termine");
    expect(markup).toContain("Inhalt");
    expect(markup).toContain('name="tasksText"');
    expect(markup).toContain('name="requirementsText"');
    expect(markup).toContain('name="fullText"');
    expect(markup).toContain('aria-label="Lebenslauf öffnen"');
    expect(markup).toContain('aria-label="Anschreiben öffnen"');
    expect(markup.indexOf('aria-label="Lebenslauf öffnen"')).toBeLessThan(
      markup.indexOf("Status &amp; Gestaltung"),
    );

    mockedStore.state = {
      ...mockedStore.state,
      workspace: {
        ...workspace,
        applications: [
          {
            ...application,
            additionalContacts: [
              {
                salutation: "Frau",
                firstName: "Erika",
                lastName: "Musterfrau",
                position: "Recruiting",
                email: "erika@example.com",
                phone: "+49 30 123456",
              },
            ],
          },
        ],
      },
    };
    const twoContactMarkup = renderToStaticMarkup(<ApplicationsView />);
    expect(twoContactMarkup).not.toContain("1. Ansprechpartner");
    expect(twoContactMarkup).not.toContain("2. Ansprechpartner");
    expect(twoContactMarkup).toContain("Erika Musterfrau");
    expect(twoContactMarkup).toContain("erika@example.com");

    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousFormData = globalThis.FormData;
    const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
    class FormFields {
      private values = new Map<string, string>();
      constructor(form: Element) {
        for (const field of Array.from(form.querySelectorAll("[name]"))) {
          this.values.set(field.getAttribute("name")!, (field as HTMLTextAreaElement).value ?? field.textContent ?? "");
        }
      }
      get(name: string) { return this.values.get(name) ?? null; }
    }
    Object.assign(globalThis, { window, document: window.document, FormData: FormFields, IS_REACT_ACT_ENVIRONMENT: true });
    try {
      const { createRoot } = await import("react-dom/client");
      const root = createRoot(window.document.getElementById("root")!);
      await act(async () => { root.render(<ApplicationsView />); });
      const tasks = window.document.querySelector<HTMLTextAreaElement>('textarea[name="tasksText"]')!;
      const requirements = window.document.querySelector<HTMLTextAreaElement>('textarea[name="requirementsText"]')!;
      const legacy = window.document.querySelector<HTMLTextAreaElement>('textarea[name="fullText"]')!;
      tasks.value = "Neue Aufgaben";
      requirements.value = "Neue Anforderungen";
      legacy.value = "Alter fiktiver Text";
      const form = tasks.closest("form")!;
      await act(async () => { form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
      expect(mockedStore.state!.saveApplication).toHaveBeenCalledWith(expect.objectContaining({
        job: expect.objectContaining({
          tasksText: "Neue Aufgaben", requirementsText: "Neue Anforderungen", fullText: "Alter fiktiver Text",
        }),
      }));
      // The Bewerbungsdetail exports both PDF packages and opens the Bewerbung's main folder.
      const button = (label: string) => Array.from(window.document.querySelectorAll<HTMLButtonElement>(".detail-actions button"))
        .find((item) => item.textContent?.includes(label) || item.getAttribute("aria-label") === label)!;
      await act(async () => { button("Bewerbungsunterlagen PDF").click(); });
      await act(async () => { button("Bewerbungsmappe PDF").click(); });
      await act(async () => { button("Bewerbungsordner öffnen").click(); });
      const id = mockedStore.state!.workspace.applications[0].id;
      expect(mockedStore.state!.exportPdf.mock.calls).toEqual([[id, "bewerbungsunterlagen"], [id, "mappe"]]);
      expect(mockedStore.state!.openFolder).toHaveBeenCalledWith(id);
      await act(async () => { root.unmount(); });
    } finally {
      Object.assign(globalThis, { window: previousWindow, document: previousDocument, FormData: previousFormData });
    }
  });

  it("saves quick successive sections on top of each other and ignores a double click", async () => {
    const now = "2026-08-08T10:00:00.000Z";
    const application = applicationSchema.parse({
      schemaVersion: 1, id: "10000000-0000-4000-8000-000000000002", folderName: "Schnell_GmbH_2026-08-08",
      company: { name: "Schnell GmbH", city: "Berlin" }, contact: {}, job: { title: "Entwicklerin", tasksText: "Alt" },
      status: "Entwurf", templateId: "classic-professional", accentColor: "#155e58", secondaryColor: "#244766",
      designSettings: defaultDocumentDesign, documents: {}, attachmentIds: [], statusHistory: [], createdAt: now, updatedAt: now,
    });
    const workspace: Workspace = {
      schemaVersion: 1, applications: [application], profiles: [], events: [], attachments: [], todos: [], customCvDesigns: [],
      settings: defaultSettings, updatedAt: now,
    };
    // A slow local save that stores what it got, like the real store.
    const saveApplication = vi.fn(async (saved: typeof application) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      mockedStore.state = { ...mockedStore.state!, workspace: { ...mockedStore.state!.workspace, applications: [saved] } };
    });
    mockedStore.state = {
      workspace, selectedApplicationId: application.id, loading: false, selectApplication: vi.fn(), saveApplication,
      changeStatus: vi.fn(), removeApplication: vi.fn(), duplicateApplication: vi.fn(), openFolder: vi.fn(), exportPdf: vi.fn(),
    };
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousFormData = globalThis.FormData;
    const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
    class FormFields {
      private values = new Map<string, string>();
      constructor(form: Element) {
        for (const field of Array.from(form.querySelectorAll("[name]"))) {
          this.values.set(field.getAttribute("name")!, (field as HTMLTextAreaElement).value ?? field.textContent ?? "");
        }
      }
      get(name: string) { return this.values.get(name) ?? null; }
    }
    Object.assign(globalThis, { window, document: window.document, FormData: FormFields, IS_REACT_ACT_ENVIRONMENT: true });
    try {
      const { createRoot } = await import("react-dom/client");
      const root = createRoot(window.document.getElementById("root")!);
      await act(async () => { root.render(<ApplicationsView />); });
      const tasks = window.document.querySelector<HTMLTextAreaElement>('textarea[name="tasksText"]')!;
      tasks.value = "Neue Aufgaben";
      const notes = window.document.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')!;
      notes.value = "Rückruf";
      const content = tasks.closest("form")!;
      const reference = window.document.querySelector<HTMLInputElement>('input[name="jobReference"]')!;
      reference.value = "REF-7";
      const company = reference.closest("form")!;
      const submit = (form: Element) => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await act(async () => {
        submit(content);
        submit(content);
        submit(company);
        await new Promise((resolve) => setTimeout(resolve, 120));
      });
      // The double click on "Inhalt" saved once; the company section was saved on top of it.
      expect(saveApplication).toHaveBeenCalledTimes(2);
      const stored = mockedStore.state!.workspace.applications[0];
      expect(stored.job).toMatchObject({ tasksText: "Neue Aufgaben", reference: "REF-7" });
      expect(stored.notes).toBe("Rückruf");
      await act(async () => { root.unmount(); });
    } finally {
      Object.assign(globalThis, { window: previousWindow, document: previousDocument, FormData: previousFormData });
    }
  });

  it("shows the interview button for interview stages and saved interview dates and opens it for that Bewerbung", async () => {
    const now = "2026-10-01T10:00:00.000Z";
    const base = (id: string, company: string, extra: Record<string, unknown>) => applicationSchema.parse({
      schemaVersion: 1, id, folderName: `${company}_2026-10-01/Entwickler`, company: { name: company, city: "Berlin" },
      contact: {}, job: { title: "Entwickler" }, status: "Gesendet", templateId: "classic-professional",
      accentColor: "#155e58", secondaryColor: "#244766", designSettings: defaultDocumentDesign, documents: {},
      attachmentIds: [], statusHistory: [{ at: now, to: "Gesendet" }], createdAt: now, updatedAt: now, ...extra,
    });
    const interview = base("20000000-0000-4000-8000-000000000001", "Seidel GmbH & Co. KG", {
      status: "Vorstellungsgespräch", interviewAt: new Date(2026, 9, 22, 10).toISOString(),
    });
    const dated = base("20000000-0000-4000-8000-000000000002", "Termin AG", { interviewAt: new Date(2026, 9, 23, 9).toISOString() });
    const plain = base("20000000-0000-4000-8000-000000000003", "Ohne GmbH", {});
    const rejected = base("20000000-0000-4000-8000-000000000004", "Absage GmbH", {
      status: "Absage", interviewAt: new Date(2026, 9, 20, 9).toISOString(),
    });
    const label = "Vorstellungsgespräch – Fragen &amp; Antworten";
    const render = (selectedApplicationId: string, initialFilter?: "active" | "interviews") => {
      mockedStore.state = {
        workspace: {
          schemaVersion: 1, applications: [interview, dated, plain, rejected], profiles: [], events: [], attachments: [],
          todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now,
        },
        selectedApplicationId, loading: false, selectApplication: vi.fn(), saveApplication: vi.fn(), changeStatus: vi.fn(),
        removeApplication: vi.fn(), duplicateApplication: vi.fn(), openFolder: vi.fn(), exportPdf: vi.fn(),
      };
      return renderToStaticMarkup(<ApplicationsView initialFilter={initialFilter} />);
    };
    expect(render(interview.id)).toContain(label);
    expect(render(interview.id, "interviews")).toContain(label);
    // In the Gespräche view the button sits next to Lebenslauf and Anschreiben, in one row.
    const interviewsMarkup = renderToStaticMarkup(
      <ApplicationsView initialFilter="interviews" onOpenResume={vi.fn()} onOpenCover={vi.fn()} />,
    );
    const nav = /<nav class="detail-document-nav"[\s\S]*?<\/nav>/.exec(interviewsMarkup)![0];
    expect([nav.indexOf("Lebenslauf öffnen"), nav.indexOf("Anschreiben öffnen"), nav.indexOf(label)].every((at) => at > 0)).toBe(true);
    expect(nav.indexOf("Anschreiben öffnen")).toBeLessThan(nav.indexOf(label));
    expect(render(dated.id)).toContain(label);
    expect(render(plain.id)).not.toContain(label);
    expect(render(rejected.id)).not.toContain(label);

    render(dated.id, "interviews");
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
    const list = vi.fn(async (applicationId: string) => ({ applicationId, folderName: "Termin_AG_2026-10-23", files: [], sharedWith: [] }));
    Object.assign(window, { bewerbungsManager: { interviews: { list, create: vi.fn(), update: vi.fn() } } });
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    try {
      const { createRoot } = await import("react-dom/client");
      const root = createRoot(window.document.getElementById("root")!);
      await act(async () => { root.render(<ApplicationsView initialFilter="interviews" />); });
      expect(window.document.querySelector('[role="dialog"]')).toBeNull();
      const open = Array.from(window.document.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Vorstellungsgespräch – Fragen & Antworten"))!;
      await act(async () => { open.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(list).toHaveBeenCalledWith(dated.id);
      const dialog = window.document.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain("Termin AG");
      expect(dialog.textContent).toContain("23.10.2026");
      await act(async () => { root.unmount(); });
    } finally {
      Object.assign(globalThis, { window: previousWindow, document: previousDocument });
    }
  });
});
