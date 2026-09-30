import { CalendarDays, Check, Circle, ExternalLink, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { Todo } from "../shared/schema";
import {
  applicationTodoKindLabels,
  isApplicationTodo,
  isTodoDueToday,
  isTodoOverdue,
  selectTodos,
  todoCounts,
  todoSourceOf,
  type TodoFilter,
  type TodoSourceFilter,
} from "../shared/todos";
import { useAppStore } from "../store/useAppStore";

const priorityLabels = { low: "Niedrig", medium: "Mittel", high: "Hoch" } as const;
const sourceLabels: Record<TodoSourceFilter, string> = { all: "Alle Aufgaben", applications: "Bewerbungen", own: "Eigene Aufgaben" };
const statusLabels: Record<TodoFilter, string> = { open: "Offen", today: "Heute", overdue: "Überfällig", completed: "Erledigt", all: "Alle" };

const blankDraft = () => ({ title: "", description: "", priority: "medium" as Todo["priority"], dueDate: "" });
const formatDate = (date: string) => new Intl.DateTimeFormat("de-DE").format(new Date(`${date}T12:00:00`));

type Props = { onOpenApplication?: (applicationId: string) => void };

export function TodoView({ onOpenApplication }: Props = {}) {
  const todos = useAppStore((state) => state.workspace.todos);
  const applications = useAppStore((state) => state.workspace.applications);
  const saveTodo = useAppStore((state) => state.saveTodo);
  const removeTodo = useAppStore((state) => state.removeTodo);
  const [source, setSource] = useState<TodoSourceFilter>("all");
  const [filter, setFilter] = useState<TodoFilter>("open");
  const [editingId, setEditingId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(blankDraft);
  const applicationById = useMemo(() => new Map(applications.map((application) => [application.id, application])), [applications]);
  const counts = useMemo(() => todoCounts(todos, applications, source), [todos, applications, source]);
  const visibleTodos = useMemo(() => selectTodos(todos, applications, source, filter).sort((a, b) => {
    const priority = { high: 0, medium: 1, low: 2 };
    return (a.completed ? 1 : 0) - (b.completed ? 1 : 0)
      || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
      || priority[a.priority] - priority[b.priority];
  }), [filter, source, todos, applications]);
  const editing = todos.find((todo) => todo.id === editingId);
  // Company, position and deadline belong to the Bewerbung: they are shown, not edited, in its todo.
  const editingLinked = Boolean(editing && isApplicationTodo(editing));

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
      ...(previous?.source ? { source: previous.source } : {}),
      ...(previous?.applicationId ? { applicationId: previous.applicationId } : {}),
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
      <article><strong>{counts.open}</strong><span>Offen</span></article>
      <article className="warning"><strong>{counts.today}</strong><span>Heute</span></article>
      <article className="danger"><strong>{counts.overdue}</strong><span>Überfällig</span></article>
      <article><strong>{counts.completed}</strong><span>Erledigt</span></article>
    </div>
    <div className="todo-filter-bar">
      <div className="todo-filter-group">
        <span className="todo-filter-label">Art</span>
        <div className="todo-filters" role="group" aria-label="Aufgaben nach Art filtern">
          {(["all", "applications", "own"] as const).map((value) => <button key={value} type="button"
            className={source === value ? "selected" : ""} aria-pressed={source === value} onClick={() => setSource(value)}>
            {sourceLabels[value]}
          </button>)}
        </div>
      </div>
      <div className="todo-filter-group">
        <span className="todo-filter-label">Status</span>
        <div className="todo-filters" role="group" aria-label="Aufgaben nach Status filtern">
          {(["open", "today", "overdue", "completed", "all"] as const).map((value) => <button key={value} type="button"
            className={filter === value ? "selected" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {statusLabels[value]}
          </button>)}
        </div>
      </div>
    </div>
    {editorOpen && <form className="surface todo-editor" onSubmit={submit}>
      <div className="todo-editor__heading"><strong>{editingId ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</strong>
        <button className="button ghost" type="button" onClick={() => setEditorOpen(false)}>Abbrechen</button></div>
      {editingLinked && <p className="todo-editor__hint">Firma, Stelle und Frist kommen aus der Bewerbung. Hier änderst du Notiz und Priorität.</p>}
      <label className="field"><span>Titel</span><input autoFocus={!editingLinked} value={draft.title} maxLength={160} required disabled={editingLinked}
        onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></label>
      <label className="field"><span>Notiz</span><textarea rows={3} value={draft.description} autoFocus={editingLinked}
        onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} /></label>
      <div className="todo-editor__row">
        <label className="field"><span>Priorität</span><select value={draft.priority}
          onChange={(event) => setDraft((value) => ({ ...value, priority: event.target.value as Todo["priority"] }))}>
          <option value="low">Niedrig</option><option value="medium">Mittel</option><option value="high">Hoch</option></select></label>
        <label className="field"><span>Fällig am</span><input type="date" value={draft.dueDate} disabled={editingLinked}
          onChange={(event) => setDraft((value) => ({ ...value, dueDate: event.target.value }))} /></label>
      </div>
      <button className="button primary" type="submit"><Check size={17} /> Speichern</button>
    </form>}
    <div className="todo-list">
      {!visibleTodos.length ? <div className="surface empty-state"><Circle size={30} /><h3>Noch keine Aufgaben</h3><p>Erstelle deine erste Aufgabe oder ändere den Filter.</p>
        <button className="button secondary" type="button" onClick={openCreate}>Aufgabe erstellen</button></div>
      : visibleTodos.map((todo) => {
        const linked = isApplicationTodo(todo);
        const application = linked && todo.applicationId ? applicationById.get(todo.applicationId) : undefined;
        const kind = linked ? applicationTodoKindLabels[todoSourceOf(todo) as keyof typeof applicationTodoKindLabels] : undefined;
        const heading = linked && application ? application.company.name : todo.title;
        const overdue = isTodoOverdue(todo);
        return <article className={`surface todo-card ${linked ? "todo-card--application" : "todo-card--own"} ${todo.completed ? "completed" : ""} ${overdue ? "overdue" : ""}`}
          data-todo-source={todoSourceOf(todo)} key={todo.id}>
          <button className="todo-check" type="button" aria-label={todo.completed ? `${heading} wieder öffnen` : `${heading} erledigen`}
            onClick={() => toggle(todo)}>{todo.completed ? <Check size={16} /> : <Circle size={16} />}</button>
          <div className="todo-card__content">
            <div className="todo-card__meta">
              <span className="todo-badge">{linked ? "Bewerbung" : "Eigene Aufgabe"}</span>
              <span className={`todo-priority ${todo.priority}`}>{priorityLabels[todo.priority]}</span>
            </div>
            <div className="todo-card__title"><strong>{heading}</strong></div>
            {linked && application && <span className="todo-card__position">{application.job.title}</span>}
            {todo.dueDate && <small className={overdue ? "danger-text" : ""}><CalendarDays size={14} /> {kind ? `${kind} · ` : "Fällig: "}{formatDate(todo.dueDate)}{overdue ? " · überfällig" : isTodoDueToday(todo) ? " · heute" : ""}</small>}
            {todo.description && <p className="todo-note"><span>Notiz</span>{todo.description}</p>}
            {linked && application && onOpenApplication && <button className="todo-open-application" type="button" onClick={() => onOpenApplication(application.id)}>
              <ExternalLink size={14} /> Bewerbung öffnen</button>}
          </div>
          <div className="todo-card__actions">
            <button className="icon-button" type="button" aria-label={`${heading} bearbeiten`} title="Bearbeiten" onClick={() => openEdit(todo)}><Pencil size={16} /></button>
            {todo.completed && <button className="icon-button" type="button" aria-label={`${heading} wieder öffnen`} title="Wieder öffnen" onClick={() => toggle(todo)}><RotateCcw size={16} /></button>}
            {!linked && <button className="icon-button danger" type="button" aria-label={`${heading} löschen`} title="Löschen" onClick={() => remove(todo)}><Trash2 size={16} /></button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
