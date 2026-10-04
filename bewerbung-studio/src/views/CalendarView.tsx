import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageCircleQuestion,
  Send,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate } from "../lib/format";
import type { CalendarEventType } from "../shared/schema";
import { useAppStore } from "../store/useAppStore";

const mondayStart = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), 1);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
};

const monthGrid = (focus: Date) => {
  const start = mondayStart(focus);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

export function CalendarView({
  onOpenApplication,
}: {
  onOpenApplication: (id?: string) => void;
}) {
  const events = useAppStore((state) => state.workspace.events);
  const saveEvent = useAppStore((state) => state.saveEvent);
  const [focus, setFocus] = useState(new Date());
  const [mode, setMode] = useState<"month" | "agenda">("month");
  const days = useMemo(() => monthGrid(focus), [focus]);
  const visible = useMemo(
    () =>
      [...events]
        .filter((event) => !event.cancelled)
        .sort(
          (left, right) =>
            new Date(left.startAt).getTime() -
            new Date(right.startAt).getTime(),
        ),
    [events],
  );
  const navigate = (direction: number) =>
    setFocus(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + direction, 1),
    );

  return (
    <div className="view-stack">
      <section className="calendar-header surface">
        <div>
          <p className="eyebrow">Zeitplanung</p>
          <h2>
            {focus.toLocaleDateString("de-DE", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="calendar-legend" aria-label="Ereignisfarben">
            <span className="application-sent">Gesendet</span>
            <span className="follow-up-call">Nachfassen</span>
            <span className="application-rejected">Absage</span>
          </div>
        </div>
        <div className="calendar-controls">
          <div className="segmented">
            <button
              className={mode === "month" ? "active" : ""}
              onClick={() => setMode("month")}>
              Monat
            </button>
            <button
              className={mode === "agenda" ? "active" : ""}
              onClick={() => setMode("agenda")}>
              Agenda
            </button>
          </div>
          <button
            className="icon-button"
            onClick={() => navigate(-1)}
            aria-label="Vorheriger Monat">
            <ChevronLeft size={18} />
          </button>
          <button
            className="button secondary"
            onClick={() => setFocus(new Date())}>
            Heute
          </button>
          <button
            className="icon-button"
            onClick={() => navigate(1)}
            aria-label="Nächster Monat">
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      {mode === "month" ? (
        <section className="calendar surface">
          <div className="weekday-row">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="month-grid">
            {days.map((day) => {
              const dayEvents = visible.filter(
                (event) =>
                  new Date(event.startAt).toDateString() === day.toDateString(),
              );
              const today = day.toDateString() === new Date().toDateString();
              return (
                <article
                  key={day.toISOString()}
                  className={`${day.getMonth() !== focus.getMonth() ? "outside" : ""} ${today ? "today" : ""}`}>
                  <strong>{day.getDate()}</strong>
                  <div>
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        className={`calendar-event ${event.type}`}
                        onClick={() => onOpenApplication(event.applicationId)}
                        title={event.title}>
                        {event.title}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="surface agenda">
          {visible.length ? (
            visible.map((event) => (
              <article
                key={event.id}
                className={`${event.completed ? "completed" : ""} event-${event.type}`}>
                <span className="agenda-date">
                  <strong>{new Date(event.startAt).getDate()}</strong>
                  <small>
                    {new Date(event.startAt).toLocaleDateString("de-DE", {
                      month: "short",
                    })}
                  </small>
                </span>
                <span className="agenda-icon">
                  {calendarEventIcon(event.type)}
                </span>
                <button
                  className="agenda-content"
                  onClick={() => onOpenApplication(event.applicationId)}>
                  <strong>{event.title}</strong>
                  <small>{formatDate(event.startAt, !event.allDay)}</small>
                </button>
                <button
                  className="icon-button"
                  title="Als erledigt markieren"
                  onClick={() =>
                    void saveEvent({
                      ...event,
                      completed: !event.completed,
                      updatedAt: new Date().toISOString(),
                    })
                  }>
                  <Check size={17} />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <CalendarDays size={24} />
              <p>Keine Kalendereinträge vorhanden.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function calendarEventIcon(type: CalendarEventType) {
  if (type === "application-sent") return <Send size={18} />;
  if (type.includes("follow-up")) return <MessageCircleQuestion size={18} />;
  if (type === "application-rejected") return <XCircle size={18} />;
  if (type.includes("interview")) return <CalendarDays size={18} />;
  return <Clock3 size={18} />;
}
