import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import {
  getDeckblattCompetencies,
  getDeckblattContacts,
  getDeckblattDocuments,
} from "./deckblatt";

const profile = profileSchema.parse({
  id: "1b10551c-b442-4ed1-ae64-386a581eb3d5",
  isDefault: true,
  firstName: "Mina",
  lastName: "Kaya",
  street: "Musterstraße 1",
  postalCode: "10115",
  city: "Berlin",
  country: "Deutschland",
  phone: "+49 30 123456",
  email: "mina@example.com",
  linkedin: "linkedin.com/in/mina-kaya",
  github: "github.com/minakaya",
  portfolio: "mina.example.com",
  skills: [
    "TypeScript – Sehr gute Kenntnisse",
    "React",
    "Node.js",
    "TypeScript",
  ],
  updatedAt: "2026-09-03T18:00:00.000Z",
});

describe("Deckblatt data", () => {
  it("uses provided contact details and concise, unique competencies", () => {
    expect(getDeckblattContacts(profile)).toEqual(
      expect.arrayContaining([
        { label: "Adresse", value: "Musterstraße 1, 10115 Berlin" },
        {
          label: "E-Mail",
          value: "mina@example.com",
          href: "mailto:mina@example.com",
        },
        {
          label: "LinkedIn",
          value: "linkedin.com/in/mina-kaya",
          href: "https://linkedin.com/in/mina-kaya",
        },
      ]),
    );
    expect(getDeckblattCompetencies(profile)).toEqual([
      "TypeScript",
      "React",
      "Node.js",
    ]);
  });

  it("shows only a compact block of three to five available competencies", () => {
    const shortProfile = profileSchema.parse({
      ...profile,
      skills: ["TypeScript", "React"],
    });
    expect(getDeckblattCompetencies(shortProfile)).toEqual([]);
    expect(
      getDeckblattCompetencies(profile, {
        job: {
          title: "Node.js Entwickler",
          reference: "",
          fullText: "Gesucht werden Node.js und React Kenntnisse.",
          source: "",
          url: "",
          workModel: "Hybrid",
          contractType: "Unbefristet",
          salaryExpectation: "",
        },
      }),
    ).toEqual(["React", "Node.js", "TypeScript"]);
  });

  it("hides only the contact fields disabled for the cover sheet", () => {
    const contacts = getDeckblattContacts(profile, {
      address: false,
      phone: true,
      email: true,
      linkedin: false,
      github: false,
      website: false,
    });
    expect(contacts.map((contact) => contact.label)).toEqual(["Telefon", "E-Mail"]);
  });

  it("lists only attachments selected for the application in package order", () => {
    expect(
      getDeckblattDocuments(
        [
          {
            id: "4d4f4b50-4f4c-4f4a-8f45-4e6f4d4d4d4d",
            applicationId: "2c0d9a5b-7e4f-4d20-9e9d-0b0e6e7d1010",
            category: "Zertifikate",
            fileName: "AWS-Zertifikat.pdf",
            description: "",
            documentDate: "",
            order: 0,
            includedInPackage: true,
            createdAt: "2026-09-03T18:00:00.000Z",
          },
          {
            id: "6d6f6b70-6f6c-4f4a-8f45-4e6f4d4d4d4d",
            applicationId: "2c0d9a5b-7e4f-4d20-9e9d-0b0e6e7d1010",
            category: "Zeugnisse",
            fileName: "Arbeitszeugnis.pdf",
            description: "",
            documentDate: "",
            order: 0,
            includedInPackage: true,
            createdAt: "2026-09-03T18:00:00.000Z",
          },
          {
            id: "7d7f7b70-7f7c-4f4a-8f45-4e6f4d4d4d4d",
            applicationId: "2c0d9a5b-7e4f-4d20-9e9d-0b0e6e7d1010",
            category: "Zeugnisse",
            fileName: "Nicht senden.pdf",
            description: "",
            documentDate: "",
            order: 1,
            includedInPackage: false,
            createdAt: "2026-09-03T18:00:00.000Z",
          },
        ],
        "2c0d9a5b-7e4f-4d20-9e9d-0b0e6e7d1010",
      ),
    ).toEqual([
      "Anschreiben",
      "Lebenslauf",
      "Arbeitszeugnis.pdf",
      "AWS-Zertifikat.pdf",
    ]);
  });
});
