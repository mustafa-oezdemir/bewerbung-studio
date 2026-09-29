import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import {
  createResumePagePlan,
  einspaltigPaginationOptions,
  elegantPaginationOptions,
  gepflegtPaginationOptions,
  getLetterPageStatus,
  ivyLeaguePaginationOptions,
  klassischPaginationOptions,
  kompaktPaginationOptions,
  kreativPaginationOptions,
  modernPaginationOptions,
  pehlionePaginationOptions,
  stilvollPaginationOptions,
  tabellarischPaginationOptions,
  zeitgenoessischPaginationOptions,
  zweispaltigPaginationOptions,
} from "./documentPagination";

const now = new Date("2026-07-19T10:00:00.000Z").toISOString();

describe("A4 document pagination", () => {
  it("keeps compact resumes on one page", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      experiences: [
        {
          id: crypto.randomUUID(),
          from: "2022",
          to: "Heute",
          role: "Entwicklerin",
          company: "Beispiel GmbH",
          achievements: ["Ladezeit um 30 % reduziert."],
        },
      ],
      education: [],
      updatedAt: now,
    });

    expect(createResumePagePlan(profile)).toHaveLength(1);
  });

  it("moves whole resume entries to a second page and never creates a third", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      experiences: Array.from({ length: 9 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2010 + index}`,
        to: `${2011 + index}`,
        role: `Position ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        achievements: Array.from(
          { length: 5 },
          (_, itemIndex) =>
            `Ergebnis ${itemIndex + 1} mit einer messbaren Verbesserung der Arbeitsabläufe.`,
        ),
      })),
      education: [],
      updatedAt: now,
    });

    const plan = createResumePagePlan(profile);
    const allIds = plan.flatMap((page) =>
      page.items.map((item) => item.id),
    );

    expect(plan).toHaveLength(2);
    expect(new Set(allIds).size).toBe(profile.experiences.length);
    expect(allIds).toHaveLength(profile.experiences.length);
  });

  it("supports compact template capacities without changing shared defaults", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      experiences: Array.from({ length: 5 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2018 + index}`,
        to: `${2019 + index}`,
        role: `Position ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        achievements: [
          "Messbares Ergebnis mit einer klaren Verbesserung.",
        ],
      })),
      education: [],
      updatedAt: now,
    });

    expect(createResumePagePlan(profile)).toHaveLength(2);
    expect(
      createResumePagePlan(
        profile,
        "",
        zweispaltigPaginationOptions,
      ),
    ).toHaveLength(1);
  });

  it("keeps long one-page visual-template profiles together", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mustafa",
      lastName: "Ã–zdemir",
      experiences: [
        [128, 170, 58],
        [80, 0, 105, 0, 121],
        [111, 0, 120, 0, 69],
      ].map((lengths, index) => ({
        id: crypto.randomUUID(),
        from: `${2012 + index * 4}`,
        to: `${2016 + index * 4}`,
        role: `Position ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        achievements: lengths.map((length) => "A".repeat(length)),
      })),
      education: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2006 + index * 2}`,
        to: `${2008 + index * 2}`,
        degree: `Abschluss ${index + 1}`,
        institution: `Hochschule ${index + 1}`,
      })),
      updatedAt: now,
    });

    const plan = createResumePagePlan(
      profile,
      "",
      modernPaginationOptions,
    );

    expect(plan).toHaveLength(1);
    expect(plan[0].items).toHaveLength(6);
    expect(plan[0].density).toBe("compact");

    const kreativPlan = createResumePagePlan(
      profile,
      "",
      kreativPaginationOptions,
    );

    expect(kreativPlan).toHaveLength(1);
    expect(kreativPlan[0].items).toHaveLength(6);
    expect(kreativPlan[0].density).toBe("compact");

    const zweispaltigPlan = createResumePagePlan(
      profile,
      "",
      zweispaltigPaginationOptions,
    );

    expect(zweispaltigPlan).toHaveLength(1);
    expect(zweispaltigPlan[0].items).toHaveLength(6);
    expect(zweispaltigPlan[0].density).toBe("compact");

    const tabellarischPlan = createResumePagePlan(
      profile,
      "",
      tabellarischPaginationOptions,
    );

    expect(tabellarischPlan).toHaveLength(1);
    expect(tabellarischPlan[0].items).toHaveLength(6);
    expect(tabellarischPlan[0].density).toBe("compact");

    const gepflegtPlan = createResumePagePlan(
      profile,
      "",
      gepflegtPaginationOptions,
    );

    expect(gepflegtPlan).toHaveLength(1);
    expect(gepflegtPlan[0].items).toHaveLength(6);
    expect(gepflegtPlan[0].density).toBe("compact");

    const zeitgenoessischPlan = createResumePagePlan(
      profile,
      "",
      zeitgenoessischPaginationOptions,
    );

    expect(zeitgenoessischPlan).toHaveLength(1);
    expect(zeitgenoessischPlan[0].items).toHaveLength(6);
    expect(zeitgenoessischPlan[0].density).toBe("compact");

    const ivyLeaguePlan = createResumePagePlan(
      profile,
      "",
      ivyLeaguePaginationOptions,
    );

    expect(ivyLeaguePlan).toHaveLength(1);
    expect(ivyLeaguePlan[0].items).toHaveLength(6);
    expect(ivyLeaguePlan[0].density).toBe("compact");

    const stilvollPlan = createResumePagePlan(
      profile,
      "",
      stilvollPaginationOptions,
    );

    expect(stilvollPlan).toHaveLength(1);
    expect(stilvollPlan[0].items).toHaveLength(6);
    expect(stilvollPlan[0].density).toBe("compact");

    const kompaktPlan = createResumePagePlan(
      profile,
      "",
      kompaktPaginationOptions,
    );

    expect(kompaktPlan).toHaveLength(1);
    expect(kompaktPlan[0].items).toHaveLength(6);
    expect(kompaktPlan[0].density).toBe("compact");

    const elegantPlan = createResumePagePlan(
      profile,
      "",
      elegantPaginationOptions,
    );

    expect(elegantPlan).toHaveLength(1);
    expect(elegantPlan[0].items).toHaveLength(6);
    expect(elegantPlan[0].density).toBe("compact");

    const klassischPlan = createResumePagePlan(
      profile,
      "",
      klassischPaginationOptions,
    );

    expect(klassischPlan).toHaveLength(1);
    expect(klassischPlan[0].items).toHaveLength(6);
    expect(klassischPlan[0].density).toBe("compact");
  });

  it("keeps Modern career items in reading order after a page split", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      experiences: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2012 + index}`,
        to: `${2013 + index}`,
        role: `Position ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        achievements: ["Messbares Ergebnis erreicht."],
      })),
      education: [
        {
          id: crypto.randomUUID(),
          from: "2008",
          to: "2012",
          degree: "Bachelor",
          institution: "Hochschule",
        },
      ],
      updatedAt: now,
    });

    const plan = createResumePagePlan(profile, "", {
      firstPageCapacity: 17,
      secondPageCapacity: 40,
      preserveItemOrder: true,
    });

    expect(plan).toHaveLength(2);
    expect(plan[0].items.map((item) => item.kind)).toEqual([
      "experience",
      "experience",
    ]);
    expect(plan[1].items.map((item) => item.kind)).toEqual([
      "experience",
      "education",
    ]);
  });

  it("moves a complete education section to page two instead of repeating it", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      experiences: Array.from({ length: 2 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2020 + index}`,
        to: `${2021 + index}`,
        role: `Position ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        achievements: ["Messbares Ergebnis erreicht."],
      })),
      education: Array.from({ length: 4 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2008 + index * 2}`,
        to: `${2010 + index * 2}`,
        degree: `Abschluss ${index + 1}`,
        institution: `Hochschule ${index + 1}`,
      })),
      updatedAt: now,
    });

    const plan = createResumePagePlan(profile, "", {
      firstPageCapacity: 19,
      secondPageCapacity: 40,
      preserveItemOrder: true,
    });

    expect(plan).toHaveLength(2);
    expect(plan[0].items.every((item) => item.kind === "experience")).toBe(true);
    expect(plan[1].items.every((item) => item.kind === "education")).toBe(true);
    expect(plan[1].items).toHaveLength(4);
  });

  it("keeps Einspaltig experience entries ahead of education after a page split", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      experiences: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2012 + index}`,
        to: `${2013 + index}`,
        role: `Position ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        achievements: Array.from(
          { length: 4 },
          (_, achievementIndex) =>
            `Messbares Ergebnis ${achievementIndex + 1} mit nachhaltiger Wirkung im Team.`,
        ),
      })),
      education: Array.from({ length: 2 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2008 + index * 2}`,
        to: `${2010 + index * 2}`,
        degree: `Abschluss ${index + 1}`,
        institution: `Hochschule ${index + 1}`,
      })),
      updatedAt: now,
    });

    const plan = createResumePagePlan(
      profile,
      "",
      einspaltigPaginationOptions,
    );
    const orderedKinds = plan.flatMap((page) =>
      page.items.map((item) => item.kind),
    );

    expect(plan).toHaveLength(2);
    expect(orderedKinds).toEqual([
      "experience",
      "experience",
      "experience",
      "education",
      "education",
    ]);
  });

  it("keeps a complete Pehlione career timeline on one compact page", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      experiences: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2014 + index}`,
        to: `${2015 + index}`,
        role: `Position ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        achievements: Array.from(
          { length: 3 },
          () => "Strukturiert dokumentierte und koordinierte Arbeitsabläufe.",
        ),
      })),
      education: [{
        id: crypto.randomUUID(),
        from: "2010",
        to: "2014",
        degree: "Abschluss",
        institution: "Hochschule",
      }],
      updatedAt: now,
    });

    const plan = createResumePagePlan(profile, "", pehlionePaginationOptions);

    expect(plan).toHaveLength(1);
    expect(plan.flatMap((page) => page.items.map((item) => item.kind))).toEqual([
      "experience",
      "experience",
      "experience",
      "education",
    ]);
  });

  it("marks long cover letters for dense one-page rendering", () => {
    const status = getLetterPageStatus({
      coverSenderName: "",
      coverSenderTitle: "",
      coverSenderContact: "",
      coverRecipientAddress: "",
      coverSubject: "Bewerbung",
      coverSubjectGapReduction: 0,
      coverGreeting: "",
      coverIntroduction: "A".repeat(900),
      coverMainBody: "",
      coverMotivation: "B".repeat(900),
      coverQualification: "C".repeat(900),
      coverCompanyFit: "D".repeat(900),
      coverExtraParagraph: "",
      coverClosing: "E".repeat(900),
      resumeProfile: "",
      deckblattStatement: "",
      emailSubject: "",
      emailMessage: "",
      emailAttachmentNote: "",
      showCoverLetterAttachments: true,
      documentListSettings: [],
    });

    expect(status.density).toBe("dense");
    expect(status.isOverRecommendedLength).toBe(true);
  });
});
