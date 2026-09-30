import { describe, expect, it } from "vitest";
import {
  applicationDateChanged,
  formatApplicationDate,
  formatApplicationDateFolder,
  formatApplicationDateIso,
  formatApplicationDateLong,
} from "./applicationDate";

describe("central application date", () => {
  it("uses the selected sent date consistently in content and paths", () => {
    const application = {
      sentAt: "2026-09-08T09:00:00.000Z",
      createdAt: "2026-09-01T09:00:00.000Z",
    };

    expect(formatApplicationDate(application)).toBe("08.09.2026");
    expect(formatApplicationDateLong(application)).toBe("8. September 2026");
    expect(formatApplicationDateFolder(new Date(application.sentAt))).toBe(
      "08.09.2026",
    );
  });

  it("detects a changed selected date and falls back to creation for drafts", () => {
    const draft = {
      sentAt: undefined,
      createdAt: "2026-09-08T09:00:00.000Z",
    };
    const changed = {
      ...draft,
      sentAt: "2026-09-15T09:00:00.000Z",
    };

    expect(formatApplicationDate(draft)).toBe("08.09.2026");
    expect(applicationDateChanged(draft, changed)).toBe(true);
  });

  it("offers the same day as an ISO calendar date for the résumé closing", () => {
    const sent = { sentAt: "2026-09-26T10:00:00.000Z", createdAt: "2026-09-01T09:00:00.000Z" };
    const draft = { sentAt: undefined, createdAt: "2026-09-08T09:00:00.000Z" };
    expect(formatApplicationDateIso(sent)).toBe("2026-09-26");
    expect(formatApplicationDateIso(draft)).toBe("2026-09-08");
    // Same day as the dd.MM.yyyy date of the Anschreiben.
    expect(formatApplicationDate(sent)).toBe("26.09.2026");
    expect(formatApplicationDateIso({ sentAt: undefined, createdAt: "not a date" })).toBe("");
  });
});
