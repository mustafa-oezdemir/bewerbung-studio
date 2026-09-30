import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application, ApplicationInput, ApplicationStatus, Todo } from "../src/shared/schema";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import {
  localDateKey,
  selectTodos,
  todoCounts,
  type TodoFilter,
  type TodoSourceFilter,
} from "../src/shared/todos";
import { DataStore } from "./storage";

const temmler = "Temmler Pharma GmbH";
const machine = "Maschinen-Einrichter für die Produktion";
const inDays = (days: number) => {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};
// A date as the application form stores it: 09:00 local time of the chosen day.
const deadline = (day: string) => new Date(`${day}T09:00:00`).toISOString();

const applicationInput = (company: string, position: string, deadlineAt?: string): ApplicationInput => ({
  company: { name: company, street: "", postalCode: "10115", city: "Berlin", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: { title: position, reference: "", source: "", url: "", fullText: "", workModel: "Hybrid", contractType: "Unbefristet", salaryExpectation: "" },
  templateId: "classic-professional",
  accentColor: "#155e58",
  secondaryColor: "#244766",
  designSettings: defaultDocumentDesign,
  notes: "",
  sentAt: "2026-09-30T09:00:00.000Z",
  ...(deadlineAt ? { deadlineAt } : {}),
});

const manualTodo = (title: string, dueDate?: string): Todo => ({
  id: crypto.randomUUID(), title, description: "", priority: "medium", completed: false,
  ...(dueDate ? { dueDate } : {}),
  createdAt: "2026-09-29T10:00:00.000Z", updatedAt: "2026-09-29T10:00:00.000Z",
});

describe("application todos follow the status of their application", () => {
  let root: string;
  let store: DataStore;

  // `null` creates an application without a deadline.
  const create = async (deadlineAt: string | null = deadline("2026-10-15"), company = temmler, position = machine) =>
    (await store.createApplication(applicationInput(company, position, deadlineAt ?? undefined))).applications[0];
  const current = (id: string): Application => store.getWorkspace().applications.find((item) => item.id === id)!;
  const save = (application: Application, changes: Partial<Application>) =>
    store.saveApplication({ ...current(application.id), ...changes });
  const autoTodos = (applicationId?: string) =>
    store.getWorkspace().todos.filter((todo) => todo.source === "application-deadline" && (!applicationId || todo.applicationId === applicationId));
  /** What the todo screen lists for a source and a status filter. */
  const listed = (source: TodoSourceFilter, filter: TodoFilter, today = "2026-10-01") => {
    const workspace = store.getWorkspace();
    return selectTodos(workspace.todos, workspace.applications, source, filter, today);
  };
  const restart = async () => {
    store = new DataStore(root);
    await store.initialize();
  };
  const readWorkspaceFile = async () => JSON.parse(await readFile(path.join(store.files.paths.settingsRoot, "workspace.json"), "utf8"));

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbungsmanager-todo-status-"));
    store = new DataStore(root);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("A. an active Bewerbung shows its todo", async () => {
    const application = await create();
    expect(current(application.id).status).toBe("Beworben");

    const [todo] = listed("applications", "open");
    expect(listed("applications", "open")).toHaveLength(1);
    expect(todo).toMatchObject({ applicationId: application.id, source: "application-deadline", dueDate: "2026-10-15", priority: "high" });
  });

  it("B. an Absage takes the todo off every list", async () => {
    const application = await create(inDays(30));
    expect(listed("all", "open")).toHaveLength(1);

    await store.changeStatus(application.id, "Absage", "Keine Begründung");

    for (const filter of ["open", "today", "overdue", "completed", "all"] as const) {
      expect(listed("all", filter, localDateKey(new Date(inDays(30)))), filter).toEqual([]);
    }
    const workspace = store.getWorkspace();
    expect(todoCounts(workspace.todos, workspace.applications)).toEqual({ open: 0, today: 0, overdue: 0, completed: 0 });
    expect(autoTodos(application.id)).toHaveLength(1); // kept for a status that is taken back, never listed
  });

  it("C. a rejected application with a future deadline gets no todo and no open calendar event", async () => {
    const application = await create(null);
    await save(application, { deadlineAt: inDays(30), status: "Absage" });

    expect(autoTodos()).toEqual([]);
    expect(listed("all", "all", "2026-10-01")).toEqual([]);
    const event = store.getWorkspace().events.find((item) => item.applicationId === application.id && item.type === "application-deadline");
    expect(event?.cancelled).toBe(true);
  });

  it("D. manual todos are not touched by an Absage", async () => {
    const manual = manualTodo("Unterlagen sortieren", "2026-10-10");
    await store.saveTodo(manual);
    const application = await create();
    await store.changeStatus(application.id, "Absage", "Keine Begründung");
    // A manual todo that only mentions the company is a manual todo, whatever its title says.
    const mention = manualTodo("Temmler Pharma anrufen", "2026-10-11");
    await store.saveTodo(mention);
    await store.changeStatus(application.id, "Archiviert");

    expect(listed("own", "all").map((todo) => todo.id).sort()).toEqual([manual.id, mention.id].sort());
    expect(listed("all", "open").map((todo) => todo.id).sort()).toEqual([manual.id, mention.id].sort());
    expect(store.getWorkspace().todos.filter((todo) => todo.source === "manual")).toHaveLength(2);
  });

  it("E. the note of the user survives a new deadline, a rename and a restart", async () => {
    const application = await create();
    const auto = autoTodos()[0];
    // What the todo list sends when the user writes a note: a todo without the link fields.
    const { applicationId: _a, source: _s, ...plain } = auto;
    await store.saveTodo({ ...plain, description: "Arbeitszeugnisse kontrollieren", updatedAt: "2026-10-01T08:00:00.000Z" });

    await save(application, { deadlineAt: deadline("2026-10-22") });
    await save(application, { company: { ...current(application.id).company, name: "Temmler Werke" } });
    await restart();

    expect(autoTodos()).toHaveLength(1);
    expect(autoTodos()[0]).toMatchObject({
      id: auto.id,
      description: "Arbeitszeugnisse kontrollieren",
      dueDate: "2026-10-22",
      title: `Bewerbungsfrist · Temmler Werke · ${machine}`,
    });
  });

  it("E. title and due date of an application todo belong to the application, priority and note to the user", async () => {
    const application = await create();
    const auto = autoTodos()[0];
    await store.saveTodo({ ...auto, title: "Etwas anderes", dueDate: "2030-01-01", priority: "low", description: "Notiz" });

    expect(autoTodos()[0]).toMatchObject({
      title: auto.title, dueDate: "2026-10-15", priority: "low", description: "Notiz",
      source: "application-deadline", applicationId: application.id,
    });
  });

  it("F. the source filter separates Bewerbung todos from own tasks", async () => {
    const own = manualTodo("IHK Unterlagen sortieren", "2026-10-18");
    await store.saveTodo(own);
    const first = await create();
    const second = await create(deadline("2026-10-20"), "Siemens", "Softwareentwickler");

    const ids = (source: TodoSourceFilter) => listed(source, "open").map((todo) => todo.id);
    expect(ids("all")).toHaveLength(3);
    expect(listed("applications", "open").map((todo) => todo.applicationId).sort()).toEqual([first.id, second.id].sort());
    expect(ids("own")).toEqual([own.id]);
  });

  it("G. source and status filters work together", async () => {
    const dueToday = manualTodo("Heute erledigen", "2026-10-15");
    await store.saveTodo(dueToday);
    const first = await create(deadline("2026-10-15"));
    await create(deadline("2026-10-20"), "Siemens", "Softwareentwickler");

    expect(listed("applications", "today", "2026-10-15").map((todo) => todo.applicationId)).toEqual([first.id]);
    expect(listed("own", "today", "2026-10-15").map((todo) => todo.id)).toEqual([dueToday.id]);
    expect(listed("all", "today", "2026-10-15")).toHaveLength(2);
    expect(listed("applications", "overdue", "2026-10-16").map((todo) => todo.applicationId)).toEqual([first.id]);
    expect(listed("own", "overdue", "2026-10-15")).toEqual([]);
  });

  it("H. counters leave out the todo of a rejected application", async () => {
    const overdue = await create(deadline("2026-09-20"));
    const today = await create(deadline("2026-10-01"), "Siemens", "Softwareentwickler");
    const rejected = await create(deadline("2026-09-25"), "Bosch", "Ingenieur");
    await store.changeStatus(rejected.id, "Absage", "Keine Begründung");

    const workspace = store.getWorkspace();
    expect(todoCounts(workspace.todos, workspace.applications, "all", "2026-10-01")).toEqual({ open: 2, today: 1, overdue: 1, completed: 0 });
    expect(todoCounts(workspace.todos, workspace.applications, "applications", "2026-10-01").open).toBe(2);
    expect(todoCounts(workspace.todos, workspace.applications, "own", "2026-10-01").open).toBe(0);
    expect(listed("all", "overdue").map((todo) => todo.applicationId)).toEqual([overdue.id]);
    expect(listed("all", "today").map((todo) => todo.applicationId)).toEqual([today.id]);
  });

  it("I. taking the Absage back brings the same todo back once, with its note", async () => {
    const application = await create();
    const auto = autoTodos()[0];
    const { applicationId: _a, source: _s, ...plain } = auto;
    await store.saveTodo({ ...plain, description: "Arbeitszeugnisse kontrollieren", priority: "low" });
    await store.changeStatus(application.id, "Absage", "Keine Begründung");
    expect(listed("all", "all")).toEqual([]);

    await store.changeStatus(application.id, "Beworben");
    await save(application, { deadlineAt: deadline("2026-10-17") });
    await restart();

    expect(autoTodos()).toHaveLength(1);
    expect(listed("applications", "open")).toHaveLength(1);
    expect(listed("applications", "open")[0]).toMatchObject({
      id: auto.id, dueDate: "2026-10-17", description: "Arbeitszeugnisse kontrollieren", priority: "low",
    });
    const event = store.getWorkspace().events.find((item) => item.applicationId === application.id && item.type === "application-deadline");
    expect(event?.cancelled).toBe(false);
  });

  it("I. a todo is created when an application without one is reactivated", async () => {
    const application = await create(null);
    await save(application, { deadlineAt: deadline("2026-10-15"), status: "Absage" });
    expect(autoTodos()).toEqual([]);

    await store.changeStatus(application.id, "Beworben");

    expect(autoTodos()).toHaveLength(1);
    expect(listed("applications", "open")).toHaveLength(1);
  });

  it.each(["Zusage", "Zurückgezogen", "Archiviert"] as const)("a %s closes the todo of the application", async (status: ApplicationStatus) => {
    const application = await create();
    await store.changeStatus(application.id, status);
    expect(listed("all", "all")).toEqual([]);
    await store.changeStatus(application.id, "Beworben");
    expect(listed("all", "open")).toHaveLength(1);
  });

  it("deleting a closed application removes its todo record", async () => {
    const manual = manualTodo("Unterlagen sortieren");
    await store.saveTodo(manual);
    const application = await create();
    await store.changeStatus(application.id, "Absage", "Keine Begründung");

    await store.removeApplication(application.id);

    expect(autoTodos()).toEqual([]);
    expect(store.getWorkspace().todos.map((todo) => todo.id)).toEqual([manual.id]);
  });

  it("a new todo saved from the UI is always an own task", async () => {
    const application = await create();
    await store.saveTodo({ ...manualTodo("Wunsch"), source: "application-deadline", applicationId: application.id });
    const saved = store.getWorkspace().todos.find((todo) => todo.title === "Wunsch")!;

    expect(saved.source).toBe("manual");
    expect(saved.applicationId).toBeUndefined();
    expect(listed("own", "open").map((todo) => todo.title)).toEqual(["Wunsch"]);
  });

  it("a workspace written before the source field opens unchanged: old todos are own tasks", async () => {
    const application = await create();
    const old = manualTodo("Bestehende Aufgabe", "2026-10-05");
    await store.saveTodo(old);
    const stored = await readWorkspaceFile();
    stored.todos = stored.todos
      .filter((todo: Todo) => todo.source !== "application-deadline")
      .map(({ source: _s, applicationId: _a, ...rest }: Todo) => rest);
    await writeFile(path.join(store.files.paths.settingsRoot, "workspace.json"), JSON.stringify(stored), "utf8");

    await restart();

    expect(store.getWorkspace().todos.find((todo) => todo.id === old.id)).toMatchObject({ title: "Bestehende Aufgabe", source: "manual", dueDate: "2026-10-05" });
    expect(listed("own", "open").map((todo) => todo.id)).toEqual([old.id]);
    expect(autoTodos(application.id)).toHaveLength(1);
  });

  it("the description the first version generated is cleared, a note of the user is not", async () => {
    const application = await create();
    const auto = autoTodos()[0];
    const stored = await readWorkspaceFile();
    stored.todos = stored.todos.map((todo: Todo) => todo.id === auto.id ? { ...todo, description: `Bewerbungsfrist für ${machine} bei ${temmler}` } : todo);
    await writeFile(path.join(store.files.paths.settingsRoot, "workspace.json"), JSON.stringify(stored), "utf8");

    await restart();
    expect(autoTodos(application.id)[0].description).toBe("");

    const { applicationId: _a, source: _s, ...plain } = autoTodos(application.id)[0];
    await store.saveTodo({ ...plain, description: "Eigene Notiz" });
    await restart();
    expect(autoTodos(application.id)[0].description).toBe("Eigene Notiz");
  });
});
