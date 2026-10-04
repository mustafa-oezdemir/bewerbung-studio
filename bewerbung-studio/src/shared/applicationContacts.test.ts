import { describe, expect, it } from "vitest";
import type { Application } from "./schema";
import {
  applicationContactDepartmentLines,
  applicationGreeting,
  applicationPostalContactLines,
  applicationRecipientLines,
} from "./applicationContacts";

const application = {
  contact: {
    salutation: "Frau",
    firstName: "Anna",
    lastName: "Müller",
    position: "Personalentwicklung",
  },
  additionalContacts: [
    {
      salutation: "Herr",
      firstName: "Mehmet",
      lastName: "Yılmaz",
      position: "Recruiting",
    },
  ],
  company: {
    name: "Beispiel GmbH",
    street: "Musterweg 7",
    postalCode: "10115",
    city: "Berlin",
  },
} as Application;

describe("application contact formatting", () => {
  it("includes both contacts in the postal recipient lines", () => {
    expect(applicationPostalContactLines(application)).toEqual([
      "Frau Anna Müller",
      "Herrn Mehmet Yılmaz",
    ]);
  });

  it("includes both contacts in the greeting", () => {
    expect(applicationGreeting(application)).toBe(
      "Sehr geehrte Frau Müller, sehr geehrter Herr Yılmaz,",
    );
  });

  it("deduplicates departments and builds recipient lines without blanks", () => {
    expect(applicationContactDepartmentLines(application)).toEqual([
      "Personalentwicklung",
      "Recruiting",
    ]);
    expect(applicationRecipientLines(application)).toEqual([
      "Beispiel GmbH",
      "Frau Anna Müller",
      "Herrn Mehmet Yılmaz",
      "Personalentwicklung",
      "Recruiting",
      "Musterweg 7",
      "10115 Berlin",
    ]);
  });
});
