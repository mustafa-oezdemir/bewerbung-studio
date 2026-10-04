import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application, ApplicationInput, Todo } from "../src/shared/schema";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { filterTodos } from "../src/shared/todos";
import { DataStore } from "./storage";

const temmler = "Temmler Pharma GmbH";
const machine = "Maschinen-Einrichter für die Produktion";
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

const manualTodo = (title: string): Todo => ({
  id: crypto.randomUUID(), title, description: "", priority: "medium", completed: false,
  createdAt: "2026-09-29T10:00:00.000Z", updatedAt: "2026-09-29T10:00:00.000Z",
});

describe("Bewerbungsfrist → Kalender + ToDo", () => {
  let root: string;
  let store: DataStore;

  const create = async (deadlineAt = deadline("2026-10-15"), company = temmler, position = machine) =>
    (await store.createApplication(applicationInput(company, position, deadlineAt))).applications[0];
  const current = (id: string): Application => store.getWorkspace().applications.find((item) => item.id === id)!;
  const save = (application: Application, changes: Partial<Application>) =>
    store.saveApplication({ ...current(application.id), ...changes });
  const todos = () => store.getWorkspace().todos;
  const autoTodos = (applicationId?: string) =>
    todos().filter((todo) => todo.source === "application-deadline" && (!applicationId || todo.applicationId === applicationId));
  const deadlineEvents = (applicationId: string) =>
    store.getWorkspace().events.filter((event) => event.applicationId === applicationId && event.type === "application-deadline");
  const restart = async () => {
    store = new DataStore(root);
    await store.initialize();
  };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbungsmanager-deadline-todo-"));
    store = new DataStore(root);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("A. a new application with a deadline gets the calendar event and one automatic high-priority todo", async () => {
    const application = await create();

    const [event] = deadlineEvents(application.id);
    expect(event).toMatchObject({ type: "application-deadline", startAt: application.deadlineAt, allDay: true, cancelled: false });
    const [todo] = autoTodos(application.id);
    expect(autoTodos()).toHaveLength(1);
    expect(todo).toMatchObject({
      title: `Bewerbungsfrist · ${temmler} · ${machine}`,
      // The description is the note of the user: the sync starts it empty and never writes it.
      description: "",
      source: "application-deadline",
      applicationId: application.id,
      dueDate: "2026-10-15",
      completed: false,
      priority: "high",
    });
    expect(todo.completedAt).toBeUndefined();
  });

  it("A. no todo without a deadline", async () => {
    await store.createApplication(applicationInput(temmler, machine));
    expect(todos()).toEqual([]);
  });

  it("B. saving the application repeatedly never creates a second todo or event", async () => {
    const application = await create();
    const first = autoTodos(application.id)[0];
    for (let round = 0; round < 3; round += 1) await save(application, { notes: `Stand ${round}` });
    await store.changeStatus(application.id, "Beworben");

    expect(autoTodos()).toHaveLength(1);
    expect(autoTodos()[0]).toMatchObject({ id: first.id, createdAt: first.createdAt });
    expect(deadlineEvents(application.id)).toHaveLength(1);
  });

  it("C. a new deadline moves the same todo and the calendar event", async () => {
    const application = await create();
    const before = autoTodos()[0];
    await save(application, { deadlineAt: deadline("2026-10-20") });

    expect(autoTodos()).toHaveLength(1);
    expect(autoTodos()[0]).toMatchObject({ id: before.id, dueDate: "2026-10-20", createdAt: before.createdAt });
    expect(deadlineEvents(application.id)).toHaveLength(1);
    expect(deadlineEvents(application.id)[0].startAt).toBe(deadline("2026-10-20"));
  });

  it("D. a changed position or company updates the title of the same todo", async () => {
    const application = await create();
    const before = autoTodos()[0];
    await save(application, { job: { ...application.job, title: "Schichtleiter Produktion" } });
    expect(autoTodos()).toHaveLength(1);
    expect(autoTodos()[0]).toMatchObject({
      id: before.id,
      title: `Bewerbungsfrist · ${temmler} · Schichtleiter Produktion`,
      description: "",
    });

    await save(application, { company: { ...current(application.id).company, name: "Temmler Werke" } });
    expect(autoTodos()).toHaveLength(1);
    expect(autoTodos()[0].title).toBe("Bewerbungsfrist · Temmler Werke · Schichtleiter Produktion");
  });

  it("E. clearing the deadline removes only the automatic todo and keeps the manual ones", async () => {
    const manual = manualTodo("Unterlagen prüfen");
    await store.saveTodo(manual);
    const application = await create();
    const other = await create(deadline("2026-11-01"), "Siemens", "Softwareentwickler");
    expect(autoTodos()).toHaveLength(2);

    await save(application, { deadlineAt: undefined });

    expect(autoTodos(application.id)).toEqual([]);
    expect(autoTodos(other.id)).toHaveLength(1);
    expect(todos().map((todo) => todo.id)).toContain(manual.id);
    // The calendar keeps its behavior: the event stays, cancelled.
    expect(deadlineEvents(application.id)).toHaveLength(1);
    expect(deadlineEvents(application.id)[0].cancelled).toBe(true);

    // A later deadline brings the todo back, exactly once.
    await save(application, { deadlineAt: deadline("2026-12-01") });
    expect(autoTodos(application.id)).toHaveLength(1);
    expect(autoTodos(application.id)[0].dueDate).toBe("2026-12-01");
    expect(deadlineEvents(application.id)[0].cancelled).toBe(false);
  });

  it("F. a manual todo is never linked, changed or removed by the sync", async () => {
    const manual = manualTodo("Unterlagen prüfen");
    await store.saveTodo({ ...manual, title: "Frist beachten", dueDate: "2026-10-15" });
    const application = await create();
    await save(application, { deadlineAt: deadline("2026-10-20"), job: { ...application.job, title: "Andere Stelle" } });
    await save(application, { deadlineAt: undefined });
    await store.removeApplication(application.id);

    const saved = todos().find((todo) => todo.id === manual.id)!;
    expect(saved).toMatchObject({ title: "Frist beachten", dueDate: "2026-10-15", source: "manual", priority: "medium" });
    expect(saved.applicationId).toBeUndefined();
    expect(todos()).toHaveLength(1);
  });

  it("F. the UI cannot turn a manual todo into an automatic one or create a second automatic todo", async () => {
    const application = await create();
    const manual = manualTodo("Anrufen");
    await store.saveTodo({ ...manual, source: "application-deadline", applicationId: application.id });

    expect(todos().find((todo) => todo.id === manual.id)).toMatchObject({ source: "manual" });
    expect(todos().find((todo) => todo.id === manual.id)?.applicationId).toBeUndefined();
    expect(autoTodos(application.id)).toHaveLength(1);
  });

  it("G. a completed automatic todo stays completed when the company is renamed; a user priority survives", async () => {
    const application = await create();
    const auto = autoTodos()[0];
    const completedAt = "2026-10-01T08:00:00.000Z";
    // What the todo list sends for a click on the checkbox and for an edit of the priority: a todo without the link fields.
    const { applicationId: _a, source: _s, ...plain } = auto;
    await store.saveTodo({ ...plain, priority: "low", completed: true, completedAt, updatedAt: completedAt });

    await save(application, { company: { ...current(application.id).company, name: "Temmler Werke" } });
    await save(application, { deadlineAt: deadline("2026-10-22") });

    expect(autoTodos()).toHaveLength(1);
    expect(autoTodos()[0]).toMatchObject({
      id: auto.id,
      title: `Bewerbungsfrist · Temmler Werke · ${machine}`,
      dueDate: "2026-10-22",
      priority: "low",
      completed: true,
      completedAt,
      createdAt: auto.createdAt,
      source: "application-deadline",
      applicationId: application.id,
    });
  });

  it("H. deleting the application removes its automatic todo and event, not other todos", async () => {
    const manual = manualTodo("Unterlagen prüfen");
    await store.saveTodo(manual);
    const application = await create();
    const other = await create(deadline("2026-11-01"), "Siemens", "Softwareentwickler");

    await store.removeApplication(application.id);

    expect(autoTodos(application.id)).toEqual([]);
    expect(autoTodos(other.id)).toHaveLength(1);
    expect(todos().map((todo) => todo.id)).toContain(manual.id);
    expect(deadlineEvents(application.id)).toEqual([]);
  });

  it("I. after a restart manual and automatic todos are there once, with the same ids", async () => {
    const manual = manualTodo("Unterlagen prüfen");
    await store.saveTodo(manual);
    const application = await create();
    const before = autoTodos()[0];

    await restart();
    await restart();

    expect(todos().filter((todo) => todo.id === manual.id)).toHaveLength(1);
    expect(autoTodos()).toHaveLength(1);
    expect(autoTodos()[0]).toEqual(before);
    expect(todos()).toHaveLength(2);
    expect(deadlineEvents(application.id)).toHaveLength(1);
  });

  it("backfill: an application of an older workspace gets its todo once; old todos become manual and are kept", async () => {
    const application = await create();
    const manual = manualTodo("Unterlagen prüfen");
    await store.saveTodo(manual);
    // Write the workspace as an older version left it: no link fields and no todo for the deadline.
    const workspacePath = path.join(store.files.paths.settingsRoot, "workspace.json");
    const stored = JSON.parse(await readFile(workspacePath, "utf8"));
    stored.todos = stored.todos
      .filter((todo: Todo) => todo.source !== "application-deadline")
      .map(({ source: _s, applicationId: _a, ...rest }: Todo) => rest);
    await writeFile(workspacePath, JSON.stringify(stored), "utf8");

    await restart();
    expect(autoTodos(application.id)).toHaveLength(1);
    expect(todos().find((todo) => todo.id === manual.id)).toMatchObject({ source: "manual", title: "Unterlagen prüfen" });
    const backfilled = autoTodos(application.id)[0];

    await restart();
    expect(todos()).toHaveLength(2);
    expect(autoTodos(application.id)[0]).toEqual(backfilled);
  });

  it("reconciliation drops duplicates and orphaned automatic todos but keeps every manual todo", async () => {
    const application = await create();
    const auto = autoTodos()[0];
    const manual = manualTodo("Unterlagen prüfen");
    await store.saveTodo(manual);
    const workspacePath = path.join(store.files.paths.settingsRoot, "workspace.json");
    const stored = JSON.parse(await readFile(workspacePath, "utf8"));
    stored.todos.push(
      { ...auto, id: crypto.randomUUID(), createdAt: "2030-01-01T00:00:00.000Z" },
      { ...auto, id: crypto.randomUUID(), applicationId: crypto.randomUUID() },
    );
    await writeFile(workspacePath, JSON.stringify(stored), "utf8");

    await restart();

    expect(autoTodos()).toHaveLength(1);
    expect(autoTodos(application.id)[0].id).toBe(auto.id);
    expect(todos().map((todo) => todo.id)).toContain(manual.id);
  });

  it("the automatic todo appears in the existing filters with the existing date logic", async () => {
    const application = await create(deadline("2026-10-15"));
    const all = todos();
    expect(filterTodos(all, "open", "2026-10-01").map((todo) => todo.applicationId)).toEqual([application.id]);
    expect(filterTodos(all, "today", "2026-10-15")).toHaveLength(1);
    expect(filterTodos(all, "today", "2026-10-14")).toHaveLength(0);
    expect(filterTodos(all, "overdue", "2026-10-16")).toHaveLength(1);
    expect(filterTodos(all, "overdue", "2026-10-15")).toHaveLength(0);
    expect(filterTodos(all, "completed", "2026-10-15")).toHaveLength(0);
    expect(filterTodos(all, "all", "2026-10-15")).toHaveLength(1);
  });

  it("a duplicated application gets its own todo for its own deadline", async () => {
    const application = await create();
    await store.duplicateApplication(application.id);
    const ids = store.getWorkspace().applications.map((item) => item.id);

    expect(ids).toHaveLength(2);
    for (const id of ids) expect(autoTodos(id).length).toBeLessThanOrEqual(1);
    expect(autoTodos(application.id)).toHaveLength(1);
    expect(autoTodos()).toHaveLength(ids.filter((id) => current(id).deadlineAt).length);
  });
});
