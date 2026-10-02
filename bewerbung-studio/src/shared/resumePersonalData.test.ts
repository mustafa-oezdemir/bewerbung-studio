import { describe, expect, it } from "vitest";
import {
  defaultResumePersonalFieldVisibility,
  resolveResumePersonalFieldVisibility,
  resumePersonalFieldKeys,
} from "../features/resume-sections/resume-section-system";
import { externalUrl, formatPhoneForDisplay, phoneHref } from "./contactPresentation";
import { getResumeDisplayProfile } from "./resumeDisplayProfile";
import { resolveResumePresentation } from "./resumePresentation";
import {
  formatGermanDate,
  formatResumeAddress,
  formatResumeBirth,
  getBlockingPersonalFields,
  getMissingPersonalFields,
  getPersonalDataIssues,
  getResumeFullName,
  getResumePersonalDetails,
  isPersonalDataComplete,
  isValidEmail,
  resumeAddressLines,
} from "./resumePersonalData";
import { profileSchema } from "./schema";

const base = {
  id: "84000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Mustafa",
  lastName: "Özdemir",
  title: "Berufsbezeichnung",
  street: "Musterstraße 10",
  postalCode: "12345",
  city: "Stuttgart",
  country: "Deutschland",
  phone: "0170 1234567",
  email: "mustafa@example.com",
  linkedin: "linkedin.com/in/test",
  github: "github.com/test",
  portfolio: "example.com",
  birthDate: "25.11.1990",
  birthPlace: "Gerze",
  nationality: "deutsch",
  familyStatus: "Verheiratet",
  children: "2",
  updatedAt: "2026-10-01T00:00:00.000Z",
};
const profile = profileSchema.parse(base);

describe("address", () => {
  it("formats one line or two lines from the same four fields", () => {
    expect(formatResumeAddress(profile, { street: true, postalCode: true })).toBe("Musterstraße 10, 12345 Stuttgart, Deutschland");
    expect(resumeAddressLines(profile, { street: true, postalCode: true })).toEqual(["Musterstraße 10", "12345 Stuttgart, Deutschland"]);
    // A visible address is printed completely; a short location is asked for explicitly.
    expect(formatResumeAddress(profile)).toBe("Musterstraße 10, 12345 Stuttgart, Deutschland");
    expect(formatResumeAddress(profile, { street: false })).toBe("12345 Stuttgart, Deutschland");
    expect(formatResumeAddress(profile, { street: false, postalCode: false })).toBe("Stuttgart, Deutschland");
  });

  it("leaves out what is empty and never prints separators for it", () => {
    expect(formatResumeAddress({ ...profile, street: "", country: "" }, { street: true, postalCode: true })).toBe("12345 Stuttgart");
    expect(formatResumeAddress({ ...profile, city: " ", postalCode: "", street: "" })).toBe("Deutschland");
    expect(formatResumeAddress({ street: "", postalCode: "", city: "", country: "" }, { street: true, postalCode: true })).toBe("");
    expect(formatResumeAddress(undefined)).toBe("");
  });
});

describe("name", () => {
  it("is resolved from firstName and lastName, never a stored field", () => {
    expect(getResumeFullName(profile)).toBe("Mustafa Özdemir");
    expect(getResumeFullName({ ...profile, lastName: "Yılmaz" })).toBe("Mustafa Yılmaz");
    expect(getResumeFullName({ firstName: " Mina ", lastName: "" })).toBe("Mina");
    expect("fullName" in profile).toBe(false);
  });
});

describe("phone and URLs", () => {
  it("shows the number as the user wrote it; only a German mobile number in plain digits gets spaces", () => {
    expect(formatPhoneForDisplay("0170 1234567")).toBe("0170 1234567");
    expect(formatPhoneForDisplay("+49 170 1234567")).toBe("+49 170 1234567");
    expect(formatPhoneForDisplay("+491701234567")).toBe("+49 170 1234567");
    expect(formatPhoneForDisplay("+49 (30) 123-456")).toBe("+49 (30) 123-456");
    expect(phoneHref("+49 170 1234567")).toBe("tel:+491701234567");
    expect(phoneHref("0170 1234567")).toBe("tel:01701234567");
    expect(phoneHref("")).toBe("");
  });

  it("completes LinkedIn, GitHub and website links the same way", () => {
    expect(externalUrl("linkedin.com/in/test")).toBe("https://linkedin.com/in/test");
    expect(externalUrl("github.com/test")).toBe("https://github.com/test");
    expect(externalUrl("example.com")).toBe("https://example.com");
    expect(externalUrl("  www.example.com/path?x=1 ")).toBe("https://www.example.com/path?x=1");
    expect(externalUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(externalUrl("http://example.com")).toBe("http://example.com");
    expect(externalUrl("")).toBe("");
  });

  it("never produces a script or other non-web target", () => {
    for (const value of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://example.com", "vbscript:x"]) {
      expect(externalUrl(value), value).toMatch(/^https:\/\//);
      expect(externalUrl(value), value).not.toMatch(/^(?:javascript|data|file|ftp|vbscript):/i);
    }
    expect(externalUrl("javascript:")).toBe("");
  });
});

describe("birth", () => {
  it("is built from birthDate and birthPlace by one formatter", () => {
    expect(formatResumeBirth(profile)).toBe("25.11.1990 in Gerze");
    expect(formatResumeBirth(profile, { prefix: true })).toBe("Geb. 25.11.1990 in Gerze");
  });

  it("works with only one of the two and is empty with none", () => {
    expect(formatResumeBirth({ birthDate: "25.11.1990", birthPlace: "" })).toBe("25.11.1990");
    expect(formatResumeBirth({ birthDate: "25.11.1990", birthPlace: "" }, { prefix: true })).toBe("Geb. 25.11.1990");
    expect(formatResumeBirth({ birthDate: "", birthPlace: "Gerze" })).toBe("Geboren in Gerze");
    expect(formatResumeBirth({ birthDate: "", birthPlace: "Gerze" }, { prefix: true })).toBe("Geb. in Gerze");
    expect(formatResumeBirth({ birthDate: " ", birthPlace: "" })).toBe("");
    expect(formatResumeBirth(undefined, { prefix: true })).toBe("");
  });

  it("shows a valid date in the German form and leaves free text alone", () => {
    expect(formatGermanDate("1990-11-25")).toBe("25.11.1990");
    expect(formatGermanDate("25/11/1990")).toBe("25.11.1990");
    expect(formatGermanDate("5.3.1990")).toBe("05.03.1990");
    expect(formatGermanDate("25.11.1990")).toBe("25.11.1990");
    expect(formatGermanDate("Mai 1990")).toBe("Mai 1990");
    expect(formatGermanDate("")).toBe("");
    // The stored value is never rewritten.
    expect(profileSchema.parse({ ...base, birthDate: "1990-11-25" }).birthDate).toBe("1990-11-25");
  });
});

describe("Freiwillige Angaben", () => {
  it("lists only what is filled, each with its own label", () => {
    expect(getResumePersonalDetails(profile).map((detail) => detail.text)).toEqual([
      "Staatsangehörigkeit: deutsch",
      "Familienstand: Verheiratet",
      "Kinder: 2",
    ]);
    expect(getResumePersonalDetails({ ...profile, nationality: "", children: " " }).map((detail) => detail.kind)).toEqual(["familyStatus"]);
    expect(getResumePersonalDetails({ nationality: "", familyStatus: "", children: "" })).toEqual([]);
  });
});

describe("Pflichtangaben and completeness", () => {
  it("is complete when name, address, phone and e-mail are there", () => {
    expect(getPersonalDataIssues(profile)).toEqual({});
    expect(isPersonalDataComplete(profile)).toBe(true);
    expect(getMissingPersonalFields(profile)).toEqual([]);
  });

  it("marks exactly the missing field", () => {
    expect(getPersonalDataIssues({ ...profile, phone: "  " })).toEqual({ phone: "missing" });
    expect(getPersonalDataIssues({ ...profile, street: "", postalCode: "" })).toEqual({ street: "missing", postalCode: "missing" });
    expect(getMissingPersonalFields({ ...profile, email: "" })).toEqual(["email"]);
    expect(isPersonalDataComplete({ ...profile, city: "" })).toBe(false);
  });

  it("still loads an older profile without address, phone or e-mail and reports what is missing", () => {
    const legacy = profileSchema.parse({ id: base.id, isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: base.updatedAt });
    expect(legacy.street).toBe("");
    expect(legacy.phone).toBe("");
    expect(legacy.email).toBe("");
    expect(getMissingPersonalFields(legacy)).toEqual(["street", "postalCode", "city", "phone", "email"]);
    expect(isPersonalDataComplete(legacy)).toBe(false);
    // Only what the schema cannot store stops a save: a name.
    expect(getBlockingPersonalFields(legacy)).toEqual([]);
    expect(getBlockingPersonalFields({ ...legacy, firstName: "" })).toEqual(["firstName"]);
  });

  it("accepts a valid e-mail and flags an invalid one", () => {
    expect(isValidEmail("mustafa@example.com")).toBe(true);
    expect(isValidEmail("")).toBe(true);
    for (const value of ["mustafa", "mustafa@", "@example.com", "mustafa@example", "a b@example.com"]) expect(isValidEmail(value), value).toBe(false);
    expect(getPersonalDataIssues({ ...profile, email: "mustafa@" })).toEqual({ email: "invalid" });
    expect(getBlockingPersonalFields({ ...profile, email: "mustafa@" })).toEqual(["email"]);
    // The same rule as the profile schema.
    expect(() => profileSchema.parse({ ...base, email: "mustafa@" })).toThrow();
  });
});

describe("visibility of the personal fields", () => {
  const legacyKeys = ["address", "phone", "email", "linkedin", "github", "website", "birthDate", "birthPlace", "nationality", "drivingLicense", "xing"];

  it("knows Familienstand and Kinder and keeps them off by default", () => {
    expect(resumePersonalFieldKeys).toContain("familyStatus");
    expect(resumePersonalFieldKeys).toContain("children");
    expect(defaultResumePersonalFieldVisibility.familyStatus).toBe(false);
    expect(defaultResumePersonalFieldVisibility.children).toBe(false);
    expect(profile.resumePersonalFieldVisibility.familyStatus).toBe(false);
    expect(profile.resumePersonalFieldVisibility.children).toBe(false);
  });

  it("loads a profile saved before the two keys existed without changing its choices", () => {
    const saved = Object.fromEntries(legacyKeys.map((key) => [key, key === "phone" ? false : key === "birthDate"]));
    const legacy = profileSchema.parse({ ...base, resumePersonalFieldVisibility: saved });
    expect(legacy.resumePersonalFieldVisibility).toMatchObject({ phone: false, birthDate: true, email: false, address: false, familyStatus: false, children: false });
    expect(legacy.resumePersonalFieldVisibility.linkedin).toBe(false);
    expect(Object.keys(legacy.resumePersonalFieldVisibility).sort()).toEqual([...resumePersonalFieldKeys].sort());
  });

  it("loads an empty or odd saved record instead of failing", () => {
    expect(profileSchema.parse({ ...base, resumePersonalFieldVisibility: {} }).resumePersonalFieldVisibility).toEqual(defaultResumePersonalFieldVisibility);
    expect(resolveResumePersonalFieldVisibility(undefined)).toEqual(defaultResumePersonalFieldVisibility);
    expect(resolveResumePersonalFieldVisibility({ phone: "yes", unknownKey: true, children: true })).toMatchObject({ phone: true, children: true });
    expect(resolveResumePersonalFieldVisibility({ unknownKey: true })).not.toHaveProperty("unknownKey");
  });

  it("keeps every personal value in the profile when the visibility is off", () => {
    const hidden = profileSchema.parse({ ...base, resumePersonalFieldVisibility: Object.fromEntries(resumePersonalFieldKeys.map((key) => [key, false])) });
    expect(hidden).toMatchObject({ phone: base.phone, linkedin: base.linkedin, github: base.github, portfolio: base.portfolio, birthDate: base.birthDate, birthPlace: base.birthPlace, nationality: "deutsch", familyStatus: "Verheiratet", children: "2" });
  });
});

describe("the display profile is the one filter", () => {
  const visible = (change: Record<string, boolean>) => ({
    ...profile,
    resumePersonalFieldVisibility: { ...Object.fromEntries(resumePersonalFieldKeys.map((key) => [key, true])), ...change } as typeof profile.resumePersonalFieldVisibility,
  });

  it("hides a field with its own switch and nothing else", () => {
    const cases: Array<[string, Partial<Record<keyof typeof base, string>>]> = [
      ["phone", { phone: "" }],
      ["email", { email: "" }],
      ["linkedin", { linkedin: "" }],
      ["github", { github: "" }],
      ["website", { portfolio: "" }],
      ["birthDate", { birthDate: "" }],
      ["birthPlace", { birthPlace: "" }],
      ["nationality", { nationality: "" }],
      ["familyStatus", { familyStatus: "" }],
      ["children", { children: "" }],
      ["address", { street: "", postalCode: "", city: "", country: "" }],
    ];
    for (const [key, blank] of cases) {
      const display = getResumeDisplayProfile(visible({ [key]: false }))!;
      const expected = { ...profile, ...blank };
      for (const field of ["phone", "email", "linkedin", "github", "portfolio", "birthDate", "birthPlace", "nationality", "familyStatus", "children", "street", "postalCode", "city", "country"] as const)
        expect(display[field], `${key} → ${field}`).toBe(expected[field]);
    }
  });

  it("does not show Familienstand and Kinder of an older profile until they are switched on", () => {
    const display = getResumeDisplayProfile(profile)!;
    expect(display.familyStatus).toBe("");
    expect(display.children).toBe("");
    expect(display.nationality).toBe("");
    const on = getResumeDisplayProfile(visible({}))!;
    expect(on.familyStatus).toBe("Verheiratet");
    expect(on.children).toBe("2");
  });

  it("takes the new keys from the profile even when archived document values exist", () => {
    const projected = resolveResumePresentation(profile, "modern", { personalFields: { familyStatus: true, children: true } })!;
    expect(getResumeDisplayProfile(projected)).toMatchObject({ familyStatus: "", children: "", nationality: "" });
    const draft = { ...profile, resumePersonalFieldVisibility: { ...profile.resumePersonalFieldVisibility, children: true } };
    expect(getResumeDisplayProfile(draft)?.children).toBe("2");
  });
});
