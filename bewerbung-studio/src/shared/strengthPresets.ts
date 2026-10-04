import type { ApplicantProfile } from "./schema";

/** Add the requested technology headings without overwriting existing records. */
export const addTechnologyStrengths = (
  strengths: ApplicantProfile["strengths"],
) => {
  const titles = new Set(
    strengths.map((item) => item.title.trim().toLocaleLowerCase("de-DE")),
  );
  return [
    ...strengths,
    ...[
      { title: "Go", description: "Echo, Gin" },
      { title: "React", description: "" },
      { title: "Spring Boot", description: "" },
    ]
      .filter((item) => !titles.has(item.title.toLocaleLowerCase("de-DE")))
      .map((item) => ({ ...item, id: crypto.randomUUID(), iconId: "" })),
  ];
};
