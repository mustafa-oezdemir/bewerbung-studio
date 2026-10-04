import { describe, expect, it } from "vitest";
import {
  buildApplicationEmailMarkdown,
  getApplicationEmail,
  resolveApplicationEmailAttachments,
  validateEmailClosingDuplication,
} from "./applicationEmail";
import { applicationSchema } from "./schema";
import { defaultDocumentDesign } from "./documentDesign";

const application = applicationSchema.parse({
  schemaVersion: 1,
  id: "f15bec4f-d0b0-4d6b-9033-061ff56ae881",
  folderName: "Muster_GmbH_08.09.2026/Softwareentwickler",
  company: {
    name: "Muster GmbH",
    street: "",
    postalCode: "10115",
    city: "Berlin",
    country: "Deutschland",
    website: "",
  },
  contact: {
    salutation: "Frau",
    firstName: "Erika",
    lastName: "Musterfrau",
    position: "Recruiting",
    email: "erika@example.com",
    phone: "",
  },
  job: {
    title: "Softwareentwickler",
    source: "",
    url: "",
    fullText: "",
    workModel: "Hybrid",
    contractType: "Unbefristet",
    salaryExpectation: "",
  },
  status: "Beworben",
  templateId: "classic-professional",
  accentColor: "#155e58",
  secondaryColor: "#244766",
  designSettings: defaultDocumentDesign,
  notes: "",
  sentAt: "2026-09-08T09:00:00.000Z",
  documents: {
    coverSubject: "",
    coverIntroduction: "",
    coverMotivation: "",
    coverQualification: "",
    coverCompanyFit: "",
    coverExtraParagraph: "",
    coverClosing: "",
    resumeProfile: "",
    deckblattStatement: "",
    emailSubject: "Bewerbung Softwareentwicklung",
    emailMessage: "Guten Tag, anbei erhalten Sie meine Bewerbung.",
    emailAttachmentNote: "Anlagen: Anschreiben und Lebenslauf",
  },
  attachmentIds: [],
  statusHistory: [],
  createdAt: "2026-09-08T08:00:00.000Z",
  updatedAt: "2026-09-08T08:00:00.000Z",
});

describe("application email", () => {
  it("derives recipient, company, role, and central date without inventing data", () => {
    expect(getApplicationEmail(application, {
      firstName: "Mustafa",
      lastName: "Özdemir",
      email: "mustafa@example.com",
    })).toMatchObject({
      applicationDate: "08.09.2026",
      companyName: "Muster GmbH",
      jobTitle: "Softwareentwickler",
      recipientName: "Frau Erika Musterfrau",
      recipientEmail: "erika@example.com",
      senderName: "Mustafa Özdemir",
      senderEmail: "mustafa@example.com",
      salutation: "Sehr geehrte Frau Musterfrau,",
      greeting: "Mit freundlichen Grüßen",
    });
    expect(buildApplicationEmailMarkdown(application)).toContain(
      "- Bewerbungsdatum: 08.09.2026",
    );
  });

  it("builds an automatic subject, salutation and signature without duplicating Bewerbung als", () => {
    const automatic = {
      ...application,
      job: {
        ...application.job,
        title: "Bewerbung als Tankstellenverkäufer - Teilzeit",
      },
      documents: {
        ...application.documents,
        emailSubject: "",
        emailMessage: "",
        emailAttachmentNote: "",
      },
    };
    const profile = {
      firstName: "Mustafa",
      lastName: "Özdemir",
      email: "mustafa@example.com",
    };
    const email = getApplicationEmail(automatic, profile);
    const markdown = buildApplicationEmailMarkdown(automatic, profile, [
      "Anschreiben",
      "Lebenslauf",
    ]);

    expect(email.subject).toBe("Bewerbung als Tankstellenverkäufer - Teilzeit");
    expect(email.subject).not.toContain("Bewerbung als Bewerbung als");
    expect(markdown).toContain("Sehr geehrte Frau Musterfrau,");
    expect(markdown).toContain("## Anlagen\n\n- Anschreiben\n- Lebenslauf");
    expect(markdown).toContain("Mit freundlichen Grüßen\n\nMustafa Özdemir");
  });

  it("renders the requested ARAL email in the final sending order", () => {
    const aral = {
      ...application,
      company: { ...application.company, name: "ARAL-Tankstelle Daniela Moter", city: "Marburg" },
      contact: {
        ...application.contact,
        firstName: "Daniela",
        lastName: "Moter",
        email: "daniela.moter@tankstelle.de",
      },
      job: { ...application.job, title: "Bewerbung als Tankstellenverkäufer - Teilzeit" },
      documents: {
        ...application.documents,
        emailSubject: "",
        emailMessage: [
          "anbei übersende ich Ihnen meine Bewerbung für die ausgeschriebene Teilzeitstelle als Tankstellenverkäufer/in (m/w/d) an Ihrer ARAL-Tankstelle in Marburg.",
          "Als Quereinsteiger bringe ich eine nachweislich strukturierte und verantwortungsbewusste Arbeitsweise mit und kann ab sofort beginnen.",
        ].join("\n\n"),
        emailAttachmentNote:
          "Mein Anschreiben und meinen Lebenslauf finden Sie im Anhang.",
      },
    };
    const markdown = buildApplicationEmailMarkdown(
      aral,
      {
        firstName: "Mustafa",
        lastName: "Özdemir",
        email: "mustafa@example.com",
      },
      ["Anschreiben", "Lebenslauf"],
    );

    expect(markdown).toContain(
      "Sehr geehrte Frau Moter,\n\nanbei übersende ich Ihnen meine Bewerbung",
    );
    expect(markdown).toContain(
      "kann ab sofort beginnen.\n\nMit freundlichen Grüßen",
    );
    expect(markdown).not.toContain(
      "Über die Gelegenheit zu einem persönlichen Gespräch freue ich mich.",
    );
    expect(markdown).toContain("Mit freundlichen Grüßen");
    expect(markdown).toContain("Mustafa Özdemir");
    expect(markdown.indexOf("Mustafa Özdemir")).toBeLessThan(
      markdown.indexOf("## Anlagen"),
    );
    expect(markdown).toContain("## Anlagen\n\n- Anschreiben\n- Lebenslauf");
  });

  it("leaves missing recipient details explicitly unfilled", () => {
    const withoutContact = {
      ...application,
      contact: { ...application.contact, firstName: "", lastName: "", email: "", salutation: "" as const },
    };
    const markdown = buildApplicationEmailMarkdown(withoutContact);
    expect(markdown).toContain("- Empfänger: Nicht angegeben");
    expect(markdown).toContain("- E-Mail-Adresse: Nicht angegeben");
  });

  it("switches between one package PDF and individual visible PDFs", () => {
    expect(resolveApplicationEmailAttachments({
      emailAttachmentMode: "package",
      emailPackageFileName: "Mina_Kaya_Bewerbung.pdf",
    }, ["Anschreiben", "Lebenslauf", "Zeugnis.pdf"])).toEqual([
      "Mina_Kaya_Bewerbung.pdf",
    ]);

    expect(resolveApplicationEmailAttachments({
      emailAttachmentMode: "separate",
      emailPackageFileName: "",
    }, ["Anschreiben", "Lebenslauf", "Zeugnis.pdf"])).toEqual([
      "Anschreiben.pdf",
      "Lebenslauf.pdf",
      "Zeugnis.pdf",
    ]);
  });

  it("warns only about repetitions in the supplied text", () => {
    expect(validateEmailClosingDuplication(
      "Ich freue mich auf ein persönliches Gespräch.",
    )).toEqual([]);
    expect(validateEmailClosingDuplication(
      "Ich freue mich auf ein persönliches Gespräch. Ein persönliches Gespräch wäre schön.",
    )).toHaveLength(1);
    expect(validateEmailClosingDuplication(
      "Die Unterlagen finden Sie im Anhang.",
    )).toEqual([]);
  });
});
