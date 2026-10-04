import { describe, expect, it } from "vitest";
import type { Application } from "./schema";
import {
  applicantDocumentFileName,
  coverLetterApplicantFileName,
  createCoverSubject,
  getCoverLetterAttachments,
  getCoverLetterMainBody,
} from "./coverLetter";

describe("cover-letter helpers", () => {
  it("migrates the two legacy body fields into one main body", () => {
    expect(
      getCoverLetterMainBody({
        coverMainBody: "",
        coverMotivation: "Erster belegbarer Punkt.",
        coverQualification: "Zweiter belegbarer Punkt.",
      }),
    ).toBe("Erster belegbarer Punkt.\n\nZweiter belegbarer Punkt.");
    expect(
      getCoverLetterMainBody({
        coverMainBody: "Neuer Hauptteil.",
        coverMotivation: "Alter Text.",
        coverQualification: "",
      }),
    ).toBe("Neuer Hauptteil.");
  });

  it("does not duplicate the Bewerbung-als prefix", () => {
    expect(createCoverSubject("Bewerbung als Verkäufer - Teilzeit")).toBe(
      "Bewerbung als Verkäufer - Teilzeit",
    );
    expect(
      createCoverSubject(
        "Verkäufer - Teilzeit",
        "Bewerbung als Bewerbung als Verkäufer - Teilzeit",
      ),
    ).toBe("Bewerbung als Verkäufer - Teilzeit");
  });

  it("lists only included application attachments after the resume", () => {
    const applicationId = crypto.randomUUID();
    const otherApplicationId = crypto.randomUUID();
    const attachment = (
      fileName: string,
      category: "Zeugnisse" | "Zertifikate",
      order: number,
      includedInPackage = true,
      owner = applicationId,
    ) => ({
      id: crypto.randomUUID(),
      applicationId: owner,
      category,
      fileName,
      description: "",
      documentDate: "",
      order,
      includedInPackage,
      createdAt: new Date().toISOString(),
    });
    expect(
      getCoverLetterAttachments(
        [
          attachment("Zertifikat.pdf", "Zertifikate", 0),
          attachment("Zeugnis.pdf", "Zeugnisse", 0),
          attachment("Nicht dabei.pdf", "Zeugnisse", 1, false),
          attachment("Andere Bewerbung.pdf", "Zeugnisse", 0, true, otherApplicationId),
        ],
        applicationId,
      ),
    ).toEqual(["Lebenslauf", "Zeugnis.pdf", "Zertifikat.pdf"]);
  });
});

const application = (companyName: string) =>
  ({
    company: { name: companyName },
    createdAt: "2026-09-16T09:00:00.000Z",
    sentAt: "2026-09-16T09:00:00.000Z",
  }) as Pick<Application, "company" | "createdAt" | "sentAt">;

describe("coverLetterApplicantFileName", () => {
  it("uses applicant and company in the application-standard file name", () => {
    expect(
      coverLetterApplicantFileName(application("Aagon GmbH"), "Mustafa Özdemir"),
    ).toBe("Anschreiben_Mustafa_Özdemir_Aagon_GmbH");
  });

  it("uses the same applicant-company order for every saved document", () => {
    expect(
      (["Anschreiben", "Lebenslauf", "Deckblatt", "Mappe"] as const).map(
        (kind) => applicantDocumentFileName(kind, application("Temmler Pharma GmbH"), "Mustafa Özdemir"),
      ),
    ).toEqual([
      "Anschreiben_Mustafa_Özdemir_Temmler_Pharma_GmbH",
      "Lebenslauf_Mustafa_Özdemir_Temmler_Pharma_GmbH",
      "Deckblatt_Mustafa_Özdemir_Temmler_Pharma_GmbH",
      "Mappe_Mustafa_Özdemir_Temmler_Pharma_GmbH",
    ]);
  });

  it("falls back to the company when no applicant name is available", () => {
    expect(coverLetterApplicantFileName(application("Muster GmbH"), "")).toBe(
      "Anschreiben_Muster_GmbH",
    );
  });
});
