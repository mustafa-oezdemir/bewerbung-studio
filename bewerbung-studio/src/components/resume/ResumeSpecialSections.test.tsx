import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { ResumeSpecialSections } from "./ResumeSpecialSections";

describe("ResumeSpecialSections", () => {
  it("renders every visible profile section with its editable heading", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      specialSections: [
        {
          id: crypto.randomUUID(),
          kind: "additional",
          title: "Was noch wichtig ist",
          entries: [
            {
              id: crypto.randomUUID(),
              title: "Reisebereitschaft",
              description: "Europaweit",
            },
          ],
        },
        {
          id: crypto.randomUUID(),
          kind: "projects",
          title: "Verborgene Projekte",
          isVisible: false,
          entries: [
            {
              id: crypto.randomUUID(),
              title: "Intern",
            },
          ],
        },
      ],
      updatedAt: new Date().toISOString(),
    });

    const markup = renderToStaticMarkup(
      <ResumeSpecialSections
        profile={profile}
        sectionClassName="template-section"
        headingClassName="template-heading"
      />,
    );

    expect(markup).toContain("Was noch wichtig ist");
    expect(markup).toContain("Reisebereitschaft");
    expect(markup).toContain("Europaweit");
    expect(markup).not.toContain("Verborgene Projekte");
  });
});
