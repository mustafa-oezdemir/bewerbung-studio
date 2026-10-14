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
};

const mockedStore = vi.hoisted(() => ({
  state: undefined as MockStoreState | undefined,
}));

vi.mock("../store/useAppStore", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) =>
    selector(mockedStore.state!),
  selectCurrentApplication: (state: MockStoreState) =>
    state.workspace.applications.find(
      (application) => application.id === state.selectedApplicationId,
    ) ?? state.workspace.applications[0],
}));

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
      await act(async () => { root.unmount(); });
    } finally {
      Object.assign(globalThis, { window: previousWindow, document: previousDocument, FormData: previousFormData });
    }
  });
});
