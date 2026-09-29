import type { Todo } from "./schema";

export type TodoFilter = "open" | "today" | "overdue" | "completed" | "all";

export const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export const actionableTodos = (todos: Todo[], today = localDateKey()) =>
  todos.filter((todo) => isTodoDueToday(todo, today) || isTodoOverdue(todo, today));
