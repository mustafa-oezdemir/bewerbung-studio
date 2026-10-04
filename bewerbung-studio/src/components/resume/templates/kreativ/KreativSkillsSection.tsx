import { ensureKnowledgeSection } from "../../../../features/knowledge/knowledge.service";
import {
  formatKnowledgeItem,
  visibleKnowledgeItems,
} from "../../../../features/knowledge/knowledge.utils";
import type { ApplicantProfile } from "../../../../shared/schema";
import { uniqueKreativValues } from "./kreativ.model";
import { KreativSectionHeading } from "./KreativSectionHeading";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function KreativSkillsSection({
  profile,
  atsMode = false,
}: {
  profile: ApplicantProfile | undefined;
  atsMode?: boolean;
}) {
  const knowledge = ensureKnowledgeSection(
    profile?.knowledgeSection,
    uniqueKreativValues(profile?.skills ?? []),
  );
  const categories = knowledge.categories
    .filter((category) => category.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .filter(
      (category) =>
        visibleKnowledgeItems(category.items).length ||
        category.subcategories.some(
          (subcategory) =>
            subcategory.isVisible &&
            visibleKnowledgeItems(subcategory.items).length,
        ),
    );
  if (!knowledge.isVisible || !categories.length) return null;

  return (
    <section
      className={`kreativ-section kreativ-skills-section ${atsMode ? "kreativ-skills-section--ats" : ""}`}
      data-element-id="kreativ.skills"
    >
      <KreativSectionHeading title={getResumeSectionTitle(profile, "knowledge")} />
      <div className="kreativ-skills">
        {categories.flatMap((category) => [
          ...visibleKnowledgeItems(category.items).map((item) => (
            <span className="kreativ-skill" key={item.id}>
              {formatKnowledgeItem(
                item,
                category.showLevels,
                category.showYearsOfExperience,
                "comma-separated",
              )}
            </span>
          )),
          ...category.subcategories
            .filter((subcategory) => subcategory.isVisible)
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .flatMap((subcategory) =>
              visibleKnowledgeItems(subcategory.items).map((item) => (
                <span className="kreativ-skill" key={item.id}>
                  {formatKnowledgeItem(
                    item,
                    category.showLevels,
                    category.showYearsOfExperience,
                    "comma-separated",
                  )}
                </span>
              )),
            ),
        ])}
      </div>
    </section>
  );
}
