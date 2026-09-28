import type { KreativCareerItem } from "./kreativ.types";
import { KreativCareerSection } from "./KreativCareerSection";
import type { ReactNode } from "react";

export function KreativLeftColumn({
  experiences,
  education,
  experienceTitle,
  educationTitle,
  continuation = false,
  children,
}: {
  experiences: KreativCareerItem[];
  education: KreativCareerItem[];
  experienceTitle: string;
  educationTitle: string;
  continuation?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className="kreativ-left-column">
      <KreativCareerSection
        kind="experience"
        title={experienceTitle}
        items={experiences}
        continuation={continuation}
      />
      <KreativCareerSection kind="education" title={educationTitle} items={education} />
      {children}
    </main>
  );
}
