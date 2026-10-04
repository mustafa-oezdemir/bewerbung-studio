import { ensureKnowledgeSection } from "../../../../features/knowledge/knowledge.service";
import {
  formatKnowledgeItem,
  visibleKnowledgeItems,
} from "../../../../features/knowledge/knowledge.utils";
import { uniqueZweispaltigValues } from "./zweispaltig.model";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import type { ZweispaltigKnowledgeProps } from "./zweispaltig.types";

export function ZweispaltigKnowledge({
  profile,
  variant,
}: ZweispaltigKnowledgeProps) {
  const knowledge = ensureKnowledgeSection(
    profile?.knowledgeSection,
    uniqueZweispaltigValues(profile?.skills ?? []),
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
      className={`zweispaltig-section zweispaltig-knowledge zweispaltig-knowledge--${variant}`}
      data-element-id="zweispaltig.skills"
    >
      <h2 className="zweispaltig-section__title">
        {getResumeSectionTitle(profile, "knowledge")}
      </h2>
      <div className="zweispaltig-knowledge__categories">
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
                  className="zweispaltig-knowledge__subcategory"
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
