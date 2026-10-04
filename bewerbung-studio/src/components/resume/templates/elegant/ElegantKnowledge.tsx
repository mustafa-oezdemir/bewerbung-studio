import { ensureKnowledgeSection } from "../../../../features/knowledge/knowledge.service";
import {
  formatKnowledgeItem,
  visibleKnowledgeItems,
} from "../../../../features/knowledge/knowledge.utils";
import { uniqueElegantValues } from "./elegant.model";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import type { ElegantKnowledgeProps } from "./elegant.types";

export function ElegantKnowledge({
  profile,
  variant,
}: ElegantKnowledgeProps) {
  const knowledge = ensureKnowledgeSection(
    profile?.knowledgeSection,
    uniqueElegantValues(profile?.skills ?? []),
  );
  const categories = knowledge.categories
    .filter((category) => category.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const visibleCategories = categories.filter(
    (category) =>
      visibleKnowledgeItems(category.items).length > 0 ||
      category.subcategories.some(
        (subcategory) =>
          subcategory.isVisible &&
          visibleKnowledgeItems(subcategory.items).length > 0,
      ),
  );

  if (!knowledge.isVisible || visibleCategories.length === 0) return null;

  return (
    <section
      className={`elegant-knowledge elegant-knowledge--${variant}`}
      data-element-id="elegant.skills"
    >
      {variant === "sidebar" ? (
        <h2 className="elegant-sidebar__title">{getResumeSectionTitle(profile, "knowledge")}</h2>
      ) : (
        <h2 className="elegant-section__title">{getResumeSectionTitle(profile, "knowledge")}</h2>
      )}
      <div className="elegant-knowledge__categories">
        {visibleCategories.map((category) => {
          const items = visibleKnowledgeItems(category.items);
          const subcategories = category.subcategories
            .filter(
              (subcategory) =>
                subcategory.isVisible &&
                visibleKnowledgeItems(subcategory.items).length > 0,
            )
            .sort((left, right) => left.sortOrder - right.sortOrder);

          return (
            <article className="elegant-knowledge__category" key={category.id}>
              <h3>{category.title}</h3>
              {category.subtitle ? <small>{category.subtitle}</small> : null}
              {items.length ? (
                <p>
                  {items
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
              {subcategories.map((subcategory) => (
                <div
                  className="elegant-knowledge__subcategory"
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
          );
        })}
      </div>
    </section>
  );
}
