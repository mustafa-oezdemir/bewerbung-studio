import type { Application, ApplicationStatus, Todo, TodoSource } from "./schema";

export type TodoFilter = "open" | "today" | "overdue" | "completed" | "all";
/** Where a todo comes from: every task, the tasks of the Bewerbungen, or the tasks the user wrote. */
export type TodoSourceFilter = "all" | "applications" | "own";

type ApplicationRef = Pick<Application, "id" | "status">;

/**
 * An application in one of these statuses needs nothing more before its deadline. One definition for the calendar
 * sync (future events are cancelled) and for the todo lists (its automatic todos are not actionable any more).
 */
export const terminalApplicationStatuses: readonly ApplicationStatus[] = [
  "Zusage",
  "Absage",
  "Zurückgezogen",
  "Archiviert",
];

export const isTerminalApplicationStatus = (status: ApplicationStatus) =>
  terminalApplicationStatuses.includes(status);

export const applicationTodoKindLabels: Record<Exclude<TodoSource, "manual">, string> = {
  "application-deadline": "Bewerbungsfrist",
};

export const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** A todo stored before `source` existed is a manual one. */
export const todoSourceOf = (todo: Pick<Todo, "source">): TodoSource => todo.source ?? "manual";

export const isApplicationTodo = (todo: Pick<Todo, "source">) => todoSourceOf(todo) !== "manual";

/**
 * Manual todos are always actionable. A todo that belongs to a Bewerbung is actionable only while that Bewerbung
 * exists and is not in a terminal status (Absage, Zusage, Zurückgezogen, Archiviert). The record of a closed
 * application keeps its note and state, so a status that is taken back brings the same todo back.
 */
const isActionable = (todo: Todo, statusOf: (applicationId: string) => ApplicationStatus | undefined) => {
  if (!isApplicationTodo(todo)) return true;
  const status = todo.applicationId ? statusOf(todo.applicationId) : undefined;
  return status !== undefined && !isTerminalApplicationStatus(status);
};

export const isActionableTodo = (todo: Todo, applications: readonly ApplicationRef[]) =>
  isActionable(todo, (id) => applications.find((application) => application.id === id)?.status);

/** Every todo list, counter and notification starts from this list. */
export const activeTodos = (todos: readonly Todo[], applications: readonly ApplicationRef[]) => {
  const statuses = new Map(applications.map((application) => [application.id, application.status]));
  return todos.filter((todo) => isActionable(todo, (id) => statuses.get(id)));
};

export const isTodoOverdue = (todo: Todo, today = localDateKey()) =>
  !todo.completed && Boolean(todo.dueDate && todo.dueDate < today);

export const isTodoDueToday = (todo: Todo, today = localDateKey()) =>
  !todo.completed && todo.dueDate === today;

export const filterTodos = (todos: Todo[], filter: TodoFilter, today = localDateKey()) =>
  todos.filter((todo) => {
    if (filter === "all") return true;
    if (filter === "completed") return todo.completed;
    if (filter === "today") return isTodoDueToday(todo, today);
    if (filter === "overdue") return isTodoOverdue(todo, today);
    return !todo.completed;
  });

export const filterTodosBySource = (todos: Todo[], source: TodoSourceFilter) =>
  todos.filter((todo) =>
    source === "all" ? true : (source === "applications") === isApplicationTodo(todo),
  );

/** The todo screen: actionable todos only, narrowed by source and by status. The two filters combine. */
export const selectTodos = (
  todos: readonly Todo[],
  applications: readonly ApplicationRef[],
  source: TodoSourceFilter,
  filter: TodoFilter,
  today = localDateKey(),
) => filterTodos(filterTodosBySource(activeTodos(todos, applications), source), filter, today);

export const todoCounts = (
  todos: readonly Todo[],
  applications: readonly ApplicationRef[],
  source: TodoSourceFilter = "all",
  today = localDateKey(),
) => {
  const scoped = filterTodosBySource(activeTodos(todos, applications), source);
  return {
    open: filterTodos(scoped, "open", today).length,
    today: filterTodos(scoped, "today", today).length,
    overdue: filterTodos(scoped, "overdue", today).length,
    completed: filterTodos(scoped, "completed", today).length,
  };
};

export const actionableTodos = (todos: Todo[], today = localDateKey()) =>
  todos.filter((todo) => isTodoDueToday(todo, today) || isTodoOverdue(todo, today));
