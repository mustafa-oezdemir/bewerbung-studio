import { ensureKnowledgeSection } from "../../../../features/knowledge/knowledge.service";
import {
  formatKnowledgeItem,
  visibleKnowledgeItems,
} from "../../../../features/knowledge/knowledge.utils";
import type { TabellarischKnowledgeProps } from "./tabellarisch.types";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function TabellarischKnowledge({
  profile,
  atsMode,
}: TabellarischKnowledgeProps) {
  const knowledge = ensureKnowledgeSection(
    profile?.knowledgeSection,
    profile?.skills ?? [],
  );
  const categories = knowledge.categories
    .filter((category) => category.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const hasVisibleContent = categories.some(
    (category) =>
      visibleKnowledgeItems(category.items).length > 0 ||
      category.subcategories.some(
        (subcategory) =>
          subcategory.isVisible &&
          visibleKnowledgeItems(subcategory.items).length > 0,
      ),
  );

  if (!knowledge.isVisible || !hasVisibleContent) return null;

  return (
    <section
      className="tabellarisch-section tabellarisch-knowledge"
      data-element-id="tabellarisch.skills"
    >
      <h2 className="tabellarisch-section__title">
        {getResumeSectionTitle(profile, "knowledge")}
      </h2>
      <div className="tabellarisch-knowledge__grid">
        {categories.map((category) => {
          const items = visibleKnowledgeItems(category.items);
          const subcategories = category.subcategories
            .filter(
              (subcategory) =>
                subcategory.isVisible &&
                visibleKnowledgeItems(subcategory.items).length > 0,
            )
            .sort((left, right) => left.sortOrder - right.sortOrder);

          if (items.length === 0 && subcategories.length === 0) return null;

          return (
            <article
              className="tabellarisch-knowledge__category"
              key={category.id}
            >
              <h3>{category.title}</h3>
              {category.subtitle ? <small>{category.subtitle}</small> : null}
              {items.length > 0 ? (
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
              {subcategories.map((subcategory) => {
                const subcategoryItems = visibleKnowledgeItems(
                  subcategory.items,
                );
                if (subcategoryItems.length === 0) return null;
                return (
                  <div
                    className="tabellarisch-knowledge__subcategory"
                    key={subcategory.id}
                  >
                    <h4>{subcategory.title}</h4>
                    <p>
                      {subcategoryItems
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
                );
              })}
            </article>
          );
        })}
      </div>
    </section>
  );
}
