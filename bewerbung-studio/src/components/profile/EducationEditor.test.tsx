import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { setResumeEducationFieldVisible } from "../../shared/resumeEducation";
import { ResumeDataEditor } from "../resume/ResumeDataEditor";
import { EducationEditor } from "./EducationEditor";

const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: "8e100000-0000-4000-8000-0000000000ff", isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: "2026-10-02T10:00:00.000Z",
    education: [{
      id: "8e100000-0000-4000-8000-000000000001", from: "09/2019", to: "07/2022", degree: "Fachinformatikerin", institution: "BBS Marburg",
      city: "Marburg", country: "Deutschland", type: "Berufsausbildung", fieldOfStudy: "Anwendungsentwicklung", grade: "1,8", status: "Abgeschlossen",
      description: "Schwerpunkt Softwareentwicklung",
    }],
    ...extra,
  });
const noop = () => undefined;
const boxes = (html: string) => {
  const fieldset = parseHTML(`<html><body>${html}</body></html>`).document.querySelector(".education-editor fieldset.career-visibility");
  return {
    legend: fieldset?.querySelector("legend")?.textContent,
    hint: fieldset?.querySelector(".field-hint")?.textContent?.replace(/\s+/g, " ").trim(),
    rows: Array.from(fieldset?.querySelectorAll(".visibility-checkbox-grid label") ?? []).map((label) => [label.textContent, label.querySelector("input")?.hasAttribute("checked")]),
  };
};

describe("Bildungsweg: Im Lebenslauf anzeigen", () => {
  it("offers the six details as checkboxes, in the grid of the career switches, with today's output as default", () => {
    const { legend, hint, rows } = boxes(renderToStaticMarkup(<EducationEditor profile={profile()} onChange={noop} />));
    expect(legend).toBe("Im Lebenslauf anzeigen");
    expect(rows).toEqual([
      ["Land", true], ["Art der Ausbildung", false], ["Fachrichtung / Schwerpunkt", true],
      ["Abschlussnote", true], ["Status", false], ["Weitere relevante Angaben", true],
    ]);
    expect(hint).toContain("Das Ausblenden löscht nichts");
  });

  it("shows the switches of the profile in the Profil and in the Lebenslauf editor alike", () => {
    const chosen = profile({ resumeEducationFieldVisibility: { country: false, type: true, fieldOfStudy: false, grade: true, status: true, description: false } });
    const expected = [["Land", false], ["Art der Ausbildung", true], ["Fachrichtung / Schwerpunkt", false], ["Abschlussnote", true], ["Status", true], ["Weitere relevante Angaben", false]];
    expect(boxes(renderToStaticMarkup(<EducationEditor profile={chosen} onChange={noop} />)).rows).toEqual(expected);
    const lebenslauf = renderToStaticMarkup(
      <ResumeDataEditor profile={chosen} section="education" defaultOpen onPreview={noop} onSave={async () => undefined} />,
    );
    expect(boxes(lebenslauf).rows).toEqual(expected);
  });

  it("a switch changes only the visibility record of the profile, never the entries", () => {
    const before = profile();
    const after = setResumeEducationFieldVisible(before, "grade", false);
    expect(after.resumeEducationFieldVisibility).toEqual({ ...before.resumeEducationFieldVisibility, grade: false });
    expect(after.education).toBe(before.education);
    expect(after.education[0].grade).toBe("1,8");
    // Saved and loaded again, the choice is still there.
    expect(profileSchema.parse(JSON.parse(JSON.stringify(after))).resumeEducationFieldVisibility.grade).toBe(false);
  });
});
