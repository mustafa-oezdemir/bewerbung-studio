import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import { getPehlioneContacts, renderPehlioneContacts } from "./pehlioneContacts";

const profile = profileSchema.parse({
  id: "83000000-0000-4000-8000-000000000001", isDefault: true,
  firstName: "Mina", lastName: "Kaya", updatedAt: "2026-09-22T00:00:00.000Z",
  country: "",
  linkedin: "linkedin.com/in/mina", github: "github.com/mina", portfolio: "mina.example.com",
});

describe("Pehlione contacts shared by preview and PDF", () => {
  it("keeps GitHub and website independent from LinkedIn visibility", () => {
    const contacts = getPehlioneContacts({ ...profile, resumePersonalFieldVisibility: {
      ...profile.resumePersonalFieldVisibility, linkedin: false,
    } });
    expect(contacts.map((contact) => contact.key)).toEqual(["github", "website"]);
    expect(contacts.map((contact) => contact.href)).toEqual(["https://github.com/mina", "https://mina.example.com"]);
    const html = renderPehlioneContacts(profile);
    expect(html).toContain('data-contact-icon="github"');
    expect(html).toContain('data-contact-icon="website"');
  });

  it("escapes profile values in the HTML used by both renderers", () => {
    const html = renderPehlioneContacts({ ...profile, city: '<img src=x onerror="alert(1)">' });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;alert(1)&quot;");
  });
});
