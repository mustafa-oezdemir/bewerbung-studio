import type { ApplicantProfile, DocumentDraft } from "./schema";
import { ensureKnowledgeSection } from "../features/knowledge/knowledge.service";
import { flattenKnowledgeNames } from "../features/knowledge/knowledge.utils";
import { getCoverLetterMainBody } from "./coverLetter";

export type ResumePageItem =
  | { kind: "experience"; id: string; weight: number }
  | { kind: "education"; id: string; weight: number };

export type ResumePagePlan = {
  pageNumber: 1 | 2;
  items: ResumePageItem[];
  density: "standard" | "compact" | "dense";
};

export type LetterPageStatus = {
  characterCount: number;
  recommendedMaximum: number;
  density: "standard" | "compact" | "dense";
  isOverRecommendedLength: boolean;
};

export type ResumePaginationOptions = {
  firstPageCapacity?: number;
  secondPageCapacity?: number;
  preserveItemOrder?: boolean;
  keepSectionsTogether?: boolean;
};

const FIRST_PAGE_CAPACITY = 30;
const SECOND_PAGE_CAPACITY = 38;
const RECOMMENDED_LETTER_CHARACTERS = 3_300;

export const zweispaltigPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

export const elegantPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

export const kompaktPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

export const kreativPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

export const tabellarischPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 48,
  secondPageCapacity: 52,
  preserveItemOrder: true,
};

export const modernPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

// Keep the career timeline together instead of putting later education entries
// on page one while an earlier role continues on page two.
export const pehlionePaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

export const gepflegtPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

export const zeitgenoessischPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

export const ivyLeaguePaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

export const stilvollPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

export const einspaltigPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 42,
  secondPageCapacity: 50,
  preserveItemOrder: true,
};

export const klassischPaginationOptions: ResumePaginationOptions = {
  firstPageCapacity: 50,
  secondPageCapacity: 54,
  preserveItemOrder: true,
};

const textWeight = (value: string, charactersPerUnit = 95) =>
  Math.max(0, Math.ceil(value.trim().length / charactersPerUnit));

const experienceWeight = (
  experience: ApplicantProfile["experiences"][number],
) =>
  4 +
  textWeight(`${experience.role} ${experience.company}`, 70) +
  experience.achievements
    .filter((achievement) => achievement.trim())
    .reduce((total, achievement) => total + 1 + textWeight(achievement), 0);

const educationWeight = (education: ApplicantProfile["education"][number]) =>
  2 + textWeight(`${education.degree} ${education.institution}`, 80);

const sidebarWeight = (
  profile: ApplicantProfile | undefined,
  resumeProfile: string,
) => {
  if (!profile) return 4;
  const summary = resumeProfile || profile.summary;
  const knowledgeCount = flattenKnowledgeNames(
    ensureKnowledgeSection(profile.knowledgeSection, profile.skills),
  ).length;
  return (
    textWeight(summary, 105) +
    Math.ceil(knowledgeCount / 3) +
    Math.ceil(profile.languages.length / 2) +
    Math.ceil(profile.certifications.length / 2)
  );
};

const densityForWeight = (
  weight: number,
  capacity: number,
): ResumePagePlan["density"] => {
  if (weight > capacity * 1.3) return "dense";
  if (weight > capacity * 0.9) return "compact";
  return "standard";
};

export const createResumePagePlan = (
  profile: ApplicantProfile | undefined,
  resumeProfile = "",
  options: ResumePaginationOptions = {},
  templateId?: string,
): ResumePagePlan[] => {
  const firstPageCapacity = options.firstPageCapacity ?? FIRST_PAGE_CAPACITY;
  const secondPageCapacity = options.secondPageCapacity ?? SECOND_PAGE_CAPACITY;
  const items: ResumePageItem[] = [
    ...(profile?.experiences ?? []).map(
      (experience): ResumePageItem => ({
        kind: "experience",
        id: experience.id,
        weight: experienceWeight(experience),
      }),
    ),
    ...(profile?.education ?? []).map(
      (education): ResumePageItem => ({
        kind: "education",
        id: education.id,
        weight: educationWeight(education),
      }),
    ),
  ];
  const managerLayout = templateId
    ? profile?.resumeManagerLayouts?.[templateId]
    : undefined;
  if (managerLayout?.length) {
    const order = managerLayout.map((item) => item.id);
    items.sort(
      (left, right) => order.indexOf(left.kind) - order.indexOf(right.kind),
    );
  }
  const totalMainWeight = items.reduce((total, item) => total + item.weight, 0);
  const firstPageWeight = Math.max(
    totalMainWeight,
    sidebarWeight(profile, resumeProfile),
  );

  if (firstPageWeight <= firstPageCapacity || items.length <= 1) {
    return [
      {
        pageNumber: 1,
        items,
        density: densityForWeight(firstPageWeight, firstPageCapacity),
      },
    ];
  }

  const pageOneItems: ResumePageItem[] = [];
  const pageTwoItems: ResumePageItem[] = [];
  let pageOneWeight = 0;
  let continueOnSecondPage = false;

  for (const item of items) {
    if (
      !continueOnSecondPage &&
      (pageOneItems.length === 0 ||
        pageOneWeight + item.weight <= firstPageCapacity)
    ) {
      pageOneItems.push(item);
      pageOneWeight += item.weight;
    } else {
      pageTwoItems.push(item);
      continueOnSecondPage =
        Boolean(managerLayout?.length) || (options.preserveItemOrder ?? false);
    }
  }

  if (pageTwoItems.length === 0 && pageOneItems.length > 1) {
    pageTwoItems.unshift(pageOneItems.pop()!);
    pageOneWeight = pageOneItems.reduce(
      (total, item) => total + item.weight,
      0,
    );
  }

  if (options.keepSectionsTogether ?? true) {
    for (const kind of ["experience", "education"] as const) {
      const firstPageKindItems = pageOneItems.filter((item) => item.kind === kind);
      const secondPageHasKind = pageTwoItems.some((item) => item.kind === kind);
      if (
        !firstPageKindItems.length ||
        !secondPageHasKind ||
        firstPageKindItems.length === pageOneItems.length
      ) {
        continue;
      }
      const movedWeight = firstPageKindItems.reduce(
        (total, item) => total + item.weight,
        0,
      );
      const currentSecondPageWeight = pageTwoItems.reduce(
        (total, item) => total + item.weight,
        0,
      );
      if (currentSecondPageWeight + movedWeight > secondPageCapacity) continue;
      for (let index = pageOneItems.length - 1; index >= 0; index -= 1) {
        if (pageOneItems[index].kind === kind) {
          pageTwoItems.push(pageOneItems.splice(index, 1)[0]);
        }
      }
      pageTwoItems.sort((left, right) => items.indexOf(left) - items.indexOf(right));
      pageOneWeight = pageOneItems.reduce(
        (total, item) => total + item.weight,
        0,
      );
    }
  }

  const pageTwoWeight = pageTwoItems.reduce(
    (total, item) => total + item.weight,
    0,
  );

  return [
    {
      pageNumber: 1,
      items: pageOneItems,
      density: densityForWeight(
        Math.max(pageOneWeight, sidebarWeight(profile, resumeProfile)),
        firstPageCapacity,
      ),
    },
    {
      pageNumber: 2,
      items: pageTwoItems,
      density: densityForWeight(pageTwoWeight, secondPageCapacity),
    },
  ];
};

export const getLetterPageStatus = <
  T extends Pick<
    DocumentDraft,
    | "coverSubject"
    | "coverIntroduction"
    | "coverMainBody"
    | "coverMotivation"
    | "coverQualification"
    | "coverCompanyFit"
    | "coverExtraParagraph"
    | "coverClosing"
  >,
>(
  documents: T,
): LetterPageStatus => {
  const characterCount = [
    documents.coverSubject,
    documents.coverIntroduction,
    getCoverLetterMainBody(documents),
    documents.coverCompanyFit,
    documents.coverExtraParagraph,
    documents.coverClosing,
  ].reduce((total, value) => total + value.trim().length, 0);

  return {
    characterCount,
    recommendedMaximum: RECOMMENDED_LETTER_CHARACTERS,
    density:
      characterCount > RECOMMENDED_LETTER_CHARACTERS
        ? "dense"
        : characterCount > 2_500
          ? "compact"
          : "standard",
    isOverRecommendedLength: characterCount > RECOMMENDED_LETTER_CHARACTERS,
  };
};
