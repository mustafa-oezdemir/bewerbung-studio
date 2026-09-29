import { CalendarDays, Check, Circle, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { Todo } from "../shared/schema";
import { filterTodos, isTodoDueToday, isTodoOverdue, type TodoFilter } from "../shared/todos";
import { useAppStore } from "../store/useAppStore";

const priorityLabels = { low: "Niedrig", medium: "Mittel", high: "Hoch" } as const;

const blankDraft = () => ({ title: "", description: "", priority: "medium" as Todo["priority"], dueDate: "" });

export function TodoView() {
  const todos = useAppStore((state) => state.workspace.todos);
  const saveTodo = useAppStore((state) => state.saveTodo);
  const removeTodo = useAppStore((state) => state.removeTodo);
  const [filter, setFilter] = useState<TodoFilter>("open");
  const [editingId, setEditingId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(blankDraft);
  const visibleTodos = useMemo(() => filterTodos(todos, filter).sort((a, b) => {
    const priority = { high: 0, medium: 1, low: 2 };
    return (a.completed ? 1 : 0) - (b.completed ? 1 : 0)
      || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
      || priority[a.priority] - priority[b.priority];
  }), [filter, todos]);

  const openCreate = () => { setEditingId(undefined); setDraft(blankDraft()); setEditorOpen(true); };
  const openEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setDraft({ title: todo.title, description: todo.description, priority: todo.priority, dueDate: todo.dueDate ?? "" });
    setEditorOpen(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    const previous = todos.find((todo) => todo.id === editingId);
    const now = new Date().toISOString();
    void saveTodo({
      id: previous?.id ?? crypto.randomUUID(), title, description: draft.description.trim(),
      priority: draft.priority, ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      completed: previous?.completed ?? false, createdAt: previous?.createdAt ?? now,
      updatedAt: now, ...(previous?.completedAt ? { completedAt: previous.completedAt } : {}),
    });
    setEditorOpen(false);
    setEditingId(undefined);
    setDraft(blankDraft());
  };
  const toggle = (todo: Todo) => {
    const completed = !todo.completed;
    void saveTodo({ ...todo, completed, updatedAt: new Date().toISOString(),
      ...(completed ? { completedAt: new Date().toISOString() } : { completedAt: undefined }) });
  };
  const remove = (todo: Todo) => {
    if (window.confirm(`„${todo.title}“ wirklich löschen?`)) void removeTodo(todo.id);
  };

  return <section className="todo-view">
    <header className="todo-view__header">
      <div><span className="eyebrow">Aufgabenplanung</span><h2>ToDo</h2><p>Offene Aufgaben, Fristen und Prioritäten an einem Ort.</p></div>
      <button className="button primary" type="button" onClick={openCreate}><Plus size={17} /> Aufgabe erstellen</button>
    </header>
    <div className="todo-summary">
      <article><strong>{todos.filter((todo) => !todo.completed).length}</strong><span>Offen</span></article>
      <article className="warning"><strong>{todos.filter((todo) => isTodoDueToday(todo)).length}</strong><span>Heute</span></article>
      <article className="danger"><strong>{todos.filter((todo) => isTodoOverdue(todo)).length}</strong><span>Überfällig</span></article>
      <article><strong>{todos.filter((todo) => todo.completed).length}</strong><span>Erledigt</span></article>
    </div>
    <div className="todo-filters" role="group" aria-label="Aufgaben filtern">
      {(["open", "today", "overdue", "completed", "all"] as const).map((value) => <button key={value} type="button"
        className={filter === value ? "selected" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>
        {{ open: "Offen", today: "Heute", overdue: "Überfällig", completed: "Erledigt", all: "Alle" }[value]}
      </button>)}
    </div>
    {editorOpen && <form className="surface todo-editor" onSubmit={submit}>
      <div className="todo-editor__heading"><strong>{editingId ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</strong>
        <button className="button ghost" type="button" onClick={() => setEditorOpen(false)}>Abbrechen</button></div>
      <label className="field"><span>Titel</span><input autoFocus value={draft.title} maxLength={160} required
        onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></label>
      <label className="field"><span>Beschreibung</span><textarea rows={3} value={draft.description}
        onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} /></label>
      <div className="todo-editor__row">
        <label className="field"><span>Priorität</span><select value={draft.priority}
          onChange={(event) => setDraft((value) => ({ ...value, priority: event.target.value as Todo["priority"] }))}>
          <option value="low">Niedrig</option><option value="medium">Mittel</option><option value="high">Hoch</option></select></label>
        <label className="field"><span>Fällig am</span><input type="date" value={draft.dueDate}
          onChange={(event) => setDraft((value) => ({ ...value, dueDate: event.target.value }))} /></label>
      </div>
      <button className="button primary" type="submit"><Check size={17} /> Speichern</button>
    </form>}
    <div className="todo-list">
      {!visibleTodos.length ? <div className="surface empty-state"><Circle size={30} /><h3>Noch keine Aufgaben</h3><p>Erstelle deine erste Aufgabe oder ändere den Filter.</p>
        <button className="button secondary" type="button" onClick={openCreate}>Aufgabe erstellen</button></div>
      : visibleTodos.map((todo) => <article className={`surface todo-card ${todo.completed ? "completed" : ""} ${isTodoOverdue(todo) ? "overdue" : ""}`} key={todo.id}>
        <button className="todo-check" type="button" aria-label={todo.completed ? `${todo.title} wieder öffnen` : `${todo.title} erledigen`}
          onClick={() => toggle(todo)}>{todo.completed ? <Check size={16} /> : <Circle size={16} />}</button>
        <div className="todo-card__content"><div className="todo-card__title"><strong>{todo.title}</strong><span className={`todo-priority ${todo.priority}`}>{priorityLabels[todo.priority]}</span></div>
          {todo.description && <p>{todo.description}</p>}
          {todo.dueDate && <small className={isTodoOverdue(todo) ? "danger-text" : ""}><CalendarDays size={14} /> {new Intl.DateTimeFormat("de-DE").format(new Date(`${todo.dueDate}T12:00:00`))}{isTodoOverdue(todo) ? " · überfällig" : isTodoDueToday(todo) ? " · heute" : ""}</small>}
        </div>
        <div className="todo-card__actions">
          <button className="icon-button" type="button" aria-label={`${todo.title} bearbeiten`} title="Bearbeiten" onClick={() => openEdit(todo)}><Pencil size={16} /></button>
          {todo.completed && <button className="icon-button" type="button" aria-label={`${todo.title} wieder öffnen`} title="Wieder öffnen" onClick={() => toggle(todo)}><RotateCcw size={16} /></button>}
          <button className="icon-button danger" type="button" aria-label={`${todo.title} löschen`} title="Löschen" onClick={() => remove(todo)}><Trash2 size={16} /></button>
        </div>
      </article>)}
    </div>
  </section>;
}
