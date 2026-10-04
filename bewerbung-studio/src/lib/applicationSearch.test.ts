import { describe, expect, it } from "vitest";
import type { Application } from "../shared/schema";
import { searchApplications } from "./applicationSearch";

const application = {
  company: { name: "Münchner Verkehrsgesellschaft", city: "München" },
  contact: { firstName: "Andreas", lastName: "Steck" },
  additionalContacts: [{ firstName: "Erika", lastName: "Musterfrau" }],
  job: { title: "Softwareentwickler" },
  status: "Vorstellungsgespräch",
} as Application;

describe("application search", () => {
  it.each([
    "münchner",
    "SOFTWARE",
    "münchen",
    "andreas",
    "Steck",
    "Andreas Steck",
    "Erika Musterfrau",
    "vorstellung",
  ])("matches %s across the searchable application fields", (query) => {
    expect(searchApplications([application], query)).toEqual([application]);
  });

  it("returns no result for an unrelated query", () => {
    expect(searchApplications([application], "Hamburg")).toEqual([]);
  });

  it("matches multiple terms across company, contact, position and city", () => {
    expect(
      searchApplications([application], "Münchner Andreas Software München"),
    ).toEqual([application]);
  });
});
