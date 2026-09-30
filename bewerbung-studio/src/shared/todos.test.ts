import { describe, expect, it } from "vitest";
import type { Todo } from "./schema";
import {
  actionableTodos,
  activeTodos,
  filterTodos,
  filterTodosBySource,
  isActionableTodo,
  isApplicationTodo,
  isTodoDueToday,
  isTodoOverdue,
  selectTodos,
  terminalApplicationStatuses,
  todoCounts,
  todoSourceOf,
} from "./todos";

const todo = (id: string, dueDate: string | undefined, completed = false): Todo => ({
  id, title: id, description: "", priority: "medium", ...(dueDate ? { dueDate } : {}), completed,
  createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z",
});

describe("todo selectors", () => {
  const items = [
    todo("10000000-0000-4000-8000-000000000001", "2026-09-28"),
    todo("10000000-0000-4000-8000-000000000002", "2026-09-29"),
    todo("10000000-0000-4000-8000-000000000003", "2026-10-01"),
    todo("10000000-0000-4000-8000-000000000004", "2026-09-28", true),
  ];

  it("distinguishes overdue, today and completed tasks", () => {
    expect(isTodoOverdue(items[0], "2026-09-29")).toBe(true);
    expect(isTodoDueToday(items[1], "2026-09-29")).toBe(true);
    expect(isTodoOverdue(items[3], "2026-09-29")).toBe(false);
  });

  it("filters and emits only actionable notifications", () => {
    expect(filterTodos(items, "open", "2026-09-29")).toHaveLength(3);
    expect(filterTodos(items, "completed", "2026-09-29")).toEqual([items[3]]);
    expect(actionableTodos(items, "2026-09-29")).toEqual([items[0], items[1]]);
  });
});

describe("todos of a Bewerbung", () => {
  const open = "20000000-0000-4000-8000-000000000001";
  const closed = "20000000-0000-4000-8000-000000000002";
  const applications = [
    { id: open, status: "Beworben" as const },
    { id: closed, status: "Absage" as const },
  ];
  const own = todo("10000000-0000-4000-8000-000000000011", "2026-09-29");
  const linked = (id: string, applicationId: string, dueDate: string): Todo => ({
    ...todo(id, dueDate), source: "application-deadline", applicationId,
  });
  const active = linked("10000000-0000-4000-8000-000000000012", open, "2026-09-29");
  const rejected = linked("10000000-0000-4000-8000-000000000013", closed, "2026-09-29");
  const orphan = linked("10000000-0000-4000-8000-000000000014", "20000000-0000-4000-8000-000000000099", "2026-09-29");
  const all = [own, active, rejected, orphan];

  it("treats a todo without source as a manual one", () => {
    expect(todoSourceOf(own)).toBe("manual");
    expect(isApplicationTodo(own)).toBe(false);
    expect(isApplicationTodo(active)).toBe(true);
  });

  it("terminal statuses are the ones the calendar sync closes", () => {
    expect([...terminalApplicationStatuses].sort()).toEqual(["Absage", "Archiviert", "Zurückgezogen", "Zusage"]);
  });

  it("lists own todos and todos of open applications only", () => {
    expect(activeTodos(all, applications)).toEqual([own, active]);
    expect(isActionableTodo(rejected, applications)).toBe(false);
    expect(isActionableTodo(orphan, applications)).toBe(false);
    expect(isActionableTodo(own, [])).toBe(true);
  });

  it("combines source and status filters", () => {
    expect(filterTodosBySource([own, active], "applications")).toEqual([active]);
    expect(filterTodosBySource([own, active], "own")).toEqual([own]);
    expect(selectTodos(all, applications, "all", "today", "2026-09-29")).toEqual([own, active]);
    expect(selectTodos(all, applications, "applications", "today", "2026-09-29")).toEqual([active]);
    expect(selectTodos(all, applications, "own", "overdue", "2026-09-30")).toEqual([own]);
    expect(todoCounts(all, applications, "all", "2026-09-30")).toEqual({ open: 2, today: 0, overdue: 2, completed: 0 });
    expect(todoCounts(all, applications, "applications", "2026-09-29")).toEqual({ open: 1, today: 1, overdue: 0, completed: 0 });
  });
});
