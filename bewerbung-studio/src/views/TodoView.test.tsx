import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDocumentDesign } from "../shared/documentDesign";
import { applicationSchema, type Application, type Todo } from "../shared/schema";
import { TodoView } from "./TodoView";

type MockStoreState = {
  workspace: { applications: Application[]; todos: Todo[] };
  saveTodo: ReturnType<typeof vi.fn>;
  removeTodo: ReturnType<typeof vi.fn>;
};

const mockedStore = vi.hoisted(() => ({ state: undefined as MockStoreState | undefined }));

vi.mock("../store/useAppStore", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => selector(mockedStore.state!),
}));

const applicationId = "30000000-0000-4000-8000-000000000001";
const rejectedId = "30000000-0000-4000-8000-000000000002";

const makeApplication = (id: string, company: string, position: string, status: Application["status"]) =>
  applicationSchema.parse({
    schemaVersion: 1, id, folderName: company, company: { name: company, city: "Berlin" }, contact: {},
    job: { title: position }, status, templateId: "classic-professional", accentColor: "#155e58",
    secondaryColor: "#244766", designSettings: defaultDocumentDesign, documents: {}, attachmentIds: [],
    statusHistory: [], createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z",
  });

const todo = (id: string, changes: Partial<Todo>): Todo => ({
  id, title: "Aufgabe", description: "", priority: "medium", completed: false,
  createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z", ...changes,
});

const render = (todos: Todo[], applications: Application[], onOpenApplication?: (id: string) => void) => {
  mockedStore.state = { workspace: { applications, todos }, saveTodo: vi.fn(), removeTodo: vi.fn() };
  return renderToStaticMarkup(<TodoView onOpenApplication={onOpenApplication} />);
};

describe("TodoView", () => {
  afterEach(() => vi.useRealTimers());

  const applications = [
    makeApplication(applicationId, "Temmler Pharma GmbH", "Maschinen-Einrichter für die Produktion", "Beworben"),
    makeApplication(rejectedId, "Bosch", "Ingenieur", "Absage"),
  ];
  const todos = [
    todo("10000000-0000-4000-8000-000000000001", {
      title: "Bewerbungsfrist · Temmler Pharma GmbH · Maschinen-Einrichter für die Produktion", priority: "high",
      dueDate: "2026-10-15", description: "Unterlagen vor dem Versand prüfen.", source: "application-deadline", applicationId,
    }),
    todo("10000000-0000-4000-8000-000000000002", {
      title: "Bewerbungsfrist · Bosch · Ingenieur", dueDate: "2026-10-16", source: "application-deadline", applicationId: rejectedId,
    }),
    todo("10000000-0000-4000-8000-000000000003", {
      title: "IHK Unterlagen sortieren", dueDate: "2026-10-18", description: "Originalzeugnis einscannen.",
    }),
  ];

  it("separates the source filter from the status filter", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
    const markup = render(todos, applications);

    for (const label of ["Alle Aufgaben", "Bewerbungen", "Eigene Aufgaben", "Offen", "Heute", "Überfällig", "Erledigt"]) {
      expect(markup, label).toContain(label);
    }
    expect(markup).toContain('aria-label="Aufgaben nach Art filtern"');
    expect(markup).toContain('aria-label="Aufgaben nach Status filtern"');
    expect(markup).toContain("Aufgabe erstellen");
  });

  it("shows a Bewerbung todo with company, position, kind, due date, priority and note", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
    const markup = render(todos, applications, () => undefined);
    const card = markup.split("<article").find((part) => part.includes('data-todo-source="application-deadline"'))!;

    expect(card).toContain("Bewerbung</span>");
    expect(card).toContain("Temmler Pharma GmbH");
    expect(card).toContain("Maschinen-Einrichter für die Produktion");
    expect(card).toContain("Bewerbungsfrist · 15.10.2026");
    expect(card).toContain("Hoch");
    expect(card).toContain("Notiz");
    expect(card).toContain("Unterlagen vor dem Versand prüfen.");
    expect(card).toContain("Bewerbung öffnen");
    // Its deletion is not offered: the todo follows the application.
    expect(card).not.toContain("löschen");
  });

  it("shows an own task with its title, due date and note, and keeps delete", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
    const markup = render(todos, applications, () => undefined);
    const card = markup.split("<article").find((part) => part.includes('data-todo-source="manual"'))!;

    expect(card).toContain("Eigene Aufgabe</span>");
    expect(card).toContain("IHK Unterlagen sortieren");
    expect(card).toContain("Fällig: 18.10.2026");
    expect(card).toContain("Originalzeugnis einscannen.");
    expect(card).toContain("löschen");
    expect(card).not.toContain("Bewerbung öffnen");
  });

  it("does not list the todo of a rejected application", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00.000Z"));
    const markup = render(todos, applications);

    expect(markup).not.toContain("Bosch");
    expect(markup.match(/data-todo-source=/g)).toHaveLength(2);
  });

  it("marks an overdue Bewerbung todo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T10:00:00.000Z"));
    const markup = render(todos, applications);
    expect(markup).toContain("Bewerbungsfrist · 15.10.2026 · überfällig");
  });
});
