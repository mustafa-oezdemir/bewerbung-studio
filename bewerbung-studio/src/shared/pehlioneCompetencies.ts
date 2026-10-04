type Strength = { title: string; description?: string };

type CompetencyGroup = {
  title: "Backend" | "Frontend" | "Weitere Kenntnisse";
  values: string[];
};

const unique = (values: string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

const frontendTechnology = (value: string) =>
  /^(react|typescript|javascript|html|css|vue|angular)/i.test(value.trim());

const backendTechnology = (value: string) =>
  /^(go(lang)?|echo|gin|spring(\s*boot)?|java|php|node(\.js)?|express)/i.test(
    value.trim(),
  );

/**
 * Splits existing strength values into visible categories. It only rearranges
 * words already supplied by the user; no skills are inferred or added.
 */
export const groupPehlioneCompetencies = (
  strengths: readonly Strength[],
): CompetencyGroup[] => {
  const buckets: Record<CompetencyGroup["title"], string[]> = {
    Backend: [],
    Frontend: [],
    "Weitere Kenntnisse": [],
  };

  strengths.forEach((strength) => {
    [strength.title, ...(strength.description ?? "").split(/[,·]/)]
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => {
        if (frontendTechnology(value)) buckets.Frontend.push(value);
        else if (backendTechnology(value)) buckets.Backend.push(value);
        else buckets["Weitere Kenntnisse"].push(value);
      });
  });

  return (Object.entries(buckets) as [CompetencyGroup["title"], string[]][])
    .map(([title, values]) => ({ title, values: unique(values) }))
    .filter((group) => group.values.length);
};
