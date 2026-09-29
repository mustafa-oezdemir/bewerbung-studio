import { describe, expect, it } from "vitest";
import type { Todo } from "./schema";
import { actionableTodos, filterTodos, isTodoDueToday, isTodoOverdue } from "./todos";

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
