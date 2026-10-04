import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDocumentDesign } from "../shared/documentDesign";
import {
  applicationSchema,
  calendarEventSchema,
  type Application,
  type CalendarEvent,
} from "../shared/schema";
import { DashboardView } from "./DashboardView";

type MockStoreState = {
  workspace: {
    applications: Application[];
    events: CalendarEvent[];
  };
  selectApplication: ReturnType<typeof vi.fn>;
};

const mockedStore = vi.hoisted(() => ({
  state: undefined as MockStoreState | undefined,
}));

vi.mock("../store/useAppStore", () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) =>
    selector(mockedStore.state!),
}));

const makeApplication = (
  id: string,
  company: string,
  status: Application["status"],
) =>
  applicationSchema.parse({
    schemaVersion: 1,
    id,
    folderName: company,
    company: { name: company, city: "Berlin" },
    contact: {},
    job: { title: "Softwareentwickler" },
    status,
    templateId: "classic-professional",
    accentColor: "#155e58",
    secondaryColor: "#244766",
    designSettings: defaultDocumentDesign,
    documents: {},
    attachmentIds: [],
    statusHistory: [],
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
  });

describe("DashboardView notifications", () => {
  afterEach(() => vi.useRealTimers());

  it("does not show events belonging to rejected applications", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T10:00:00.000Z"));
    const rejected = makeApplication(
      "30000000-0000-4000-8000-000000000001",
      "Absage GmbH",
      "Absage",
    );
    const active = makeApplication(
      "30000000-0000-4000-8000-000000000002",
      "Aktiv GmbH",
      "Beworben",
    );
    const events = [
      calendarEventSchema.parse({
        id: "40000000-0000-4000-8000-000000000001",
        applicationId: rejected.id,
        type: "application-sent",
        title: "Diese Absage-Benachrichtigung darf nicht erscheinen",
        startAt: "2026-08-10T09:00:00.000Z",
        allDay: true,
        completed: false,
        cancelled: false,
        reminderMinutes: [],
        createdAt: "2026-08-01T09:00:00.000Z",
        updatedAt: "2026-08-01T09:00:00.000Z",
      }),
      calendarEventSchema.parse({
        id: "40000000-0000-4000-8000-000000000002",
        applicationId: active.id,
        type: "follow-up-call",
        title: "Aktiv GmbH · Nachfassen",
        startAt: "2026-08-12T09:00:00.000Z",
        allDay: false,
        completed: false,
        cancelled: false,
        reminderMinutes: [],
        createdAt: "2026-08-01T09:00:00.000Z",
        updatedAt: "2026-08-01T09:00:00.000Z",
      }),
    ];
    mockedStore.state = {
      workspace: { applications: [rejected, active], events },
      selectApplication: vi.fn(),
    };

    const markup = renderToStaticMarkup(
      <DashboardView onOpenApplications={vi.fn()} onOpenCalendar={vi.fn()} />,
    );

    expect(markup).toContain("Aktiv GmbH · Nachfassen");
    expect(markup).not.toContain(
      "Diese Absage-Benachrichtigung darf nicht erscheinen",
    );
  });
});

describe("first steps", () => {
  const render = (profiles: unknown[]) => {
    mockedStore.state = {
      workspace: { applications: [], events: [], profiles } as unknown as MockStoreState["workspace"],
      selectApplication: vi.fn(),
    };
    return renderToStaticMarkup(
      <DashboardView onOpenApplications={vi.fn()} onOpenCalendar={vi.fn()} onOpenProfile={vi.fn()} onOpenSettings={vi.fn()}
        workspaceRoot="D:/Daten/BewerbungsManager" />,
    );
  };

  it("suggests creating the profile and shows where the data is kept while there is no profile", () => {
    const html = render([]);
    expect(html).toContain("Legen Sie zuerst Ihr Profil an.");
    expect(html).toContain("Profil anlegen");
    expect(html).toContain("D:/Daten/BewerbungsManager");
    expect(html).toContain("Speicherort ändern");
  });

  it("is gone once a profile exists", () => {
    expect(render([{ id: "p" }])).not.toContain("Legen Sie zuerst Ihr Profil an.");
  });
});
