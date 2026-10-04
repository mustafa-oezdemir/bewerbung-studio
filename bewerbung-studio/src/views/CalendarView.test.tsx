import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calendarEventSchema,
  type CalendarEvent,
} from "../shared/schema";
import { CalendarView } from "./CalendarView";

type MockStoreState = {
  workspace: { events: CalendarEvent[] };
  saveEvent: ReturnType<typeof vi.fn>;
};

const mockedStore = vi.hoisted(() => ({
  state: undefined as MockStoreState | undefined,
}));

vi.mock("../store/useAppStore", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) =>
    selector(mockedStore.state!),
}));

describe("CalendarView", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows every application event in a day without a hidden remainder", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T10:00:00.000Z"));

    const events = Array.from({ length: 6 }, (_, index) =>
      calendarEventSchema.parse({
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        type: "application-sent",
        title: `Bewerbung ${index + 1}`,
        startAt: "2026-08-11T08:00:00.000Z",
        allDay: true,
        completed: false,
        cancelled: false,
        reminderMinutes: [],
        createdAt: "2026-08-11T08:00:00.000Z",
        updatedAt: "2026-08-11T08:00:00.000Z",
      }),
    );
    mockedStore.state = {
      workspace: { events },
      saveEvent: vi.fn(),
    };

    const markup = renderToStaticMarkup(
      <CalendarView onOpenApplication={vi.fn()} />,
    );

    for (const event of events) {
      expect(markup).toContain(event.title);
    }
    expect(markup).not.toContain("weitere");
  });

  it("shows company names and the requested colors for application milestones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T10:00:00.000Z"));
    const types = [
      ["application-sent", "Beispiel GmbH · Bewerbung gesendet"],
      ["follow-up-call", "Beispiel GmbH · Nachfassen"],
      ["application-rejected", "Beispiel GmbH · Absage"],
    ] as const;
    const events = types.map(([type, title], index) =>
      calendarEventSchema.parse({
        id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        type,
        title,
        startAt: "2026-08-11T08:00:00.000Z",
        allDay: true,
        completed: false,
        cancelled: false,
        reminderMinutes: [],
        createdAt: "2026-08-11T08:00:00.000Z",
        updatedAt: "2026-08-11T08:00:00.000Z",
      }),
    );
    mockedStore.state = {
      workspace: { events },
      saveEvent: vi.fn(),
    };

    const markup = renderToStaticMarkup(
      <CalendarView onOpenApplication={vi.fn()} />,
    );

    for (const [type, title] of types) {
      expect(markup).toContain(`calendar-event ${type}`);
      expect(markup).toContain(title);
    }
  });
});
