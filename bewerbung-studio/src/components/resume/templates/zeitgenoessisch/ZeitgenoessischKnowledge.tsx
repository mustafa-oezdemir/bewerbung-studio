import { ensureKnowledgeSection } from "../../../../features/knowledge/knowledge.service";
import {
  formatKnowledgeItem,
  visibleKnowledgeItems,
} from "../../../../features/knowledge/knowledge.utils";
import type { ApplicantProfile } from "../../../../shared/schema";
import { uniqueZeitgenoessischValues } from "./zeitgenoessisch.model";
import { ZeitgenoessischSectionHeading } from "./ZeitgenoessischSectionHeading";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function ZeitgenoessischKnowledge({
  profile,
}: {
  profile: ApplicantProfile | undefined;
}) {
  const knowledge = ensureKnowledgeSection(
    profile?.knowledgeSection,
    uniqueZeitgenoessischValues(profile?.skills ?? []),
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
      className="zeitgenoessisch-section zeitgenoessisch-knowledge"
      data-element-id="zeitgenoessisch.skills"
    >
      <ZeitgenoessischSectionHeading title={getResumeSectionTitle(profile, "knowledge")} icon="knowledge" />
      <div className="zeitgenoessisch-knowledge__categories">
        {categories.map((category) => (
          <article key={category.id}>
            <h3>{category.title}</h3>
            {category.subtitle ? <small>{category.subtitle}</small> : null}
            {visibleKnowledgeItems(category.items).length ? (
              <p>
                {visibleKnowledgeItems(category.items)
                  .map((item) =>
                    formatKnowledgeItem(
                      item,
                      category.showLevels,
                      category.showYearsOfExperience,
                      "comma-separated",
                    ),
                  )
                  .join(", ")}
              </p>
            ) : null}
            {category.subcategories
              .filter(
                (subcategory) =>
                  subcategory.isVisible &&
                  visibleKnowledgeItems(subcategory.items).length,
              )
              .sort((left, right) => left.sortOrder - right.sortOrder)
              .map((subcategory) => (
                <div
                  className="zeitgenoessisch-knowledge__subcategory"
                  key={subcategory.id}
                >
                  <h4>{subcategory.title}</h4>
                  <p>
                    {visibleKnowledgeItems(subcategory.items)
                      .map((item) =>
                        formatKnowledgeItem(
                          item,
                          category.showLevels,
                          category.showYearsOfExperience,
                          "comma-separated",
                        ),
                      )
                      .join(", ")}
                  </p>
                </div>
              ))}
          </article>
        ))}
      </div>
    </section>
  );
}
