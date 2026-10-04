import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { getProfileMediaSource } from "../../shared/profileMedia";
import { getResumeSemanticSection, resolveResumeSectionInstances } from "./resume-section-system";
import { mergeResumeDataDraft, mergeResumeSectionDraft } from "./resume-editor-settings";

const photo = "data:image/png;base64,AA==";
const profile = profileSchema.parse({
  id: "55e95a6d-c1d8-4e55-a5be-fbdb12d4cd20",
  isDefault: true,
  firstName: "Mina",
  lastName: "Kaya",
  photoPath: photo,
  updatedAt: "2026-09-22T00:00:00.000Z",
});

const photoVisible = {
  ...profile,
  resumeSemanticSections: resolveResumeSectionInstances([]).map((section) =>
    section.semanticType === "photo"
      ? { ...section, visible: true, enabled: true }
      : section,
  ),
};

describe("resume editor draft merging", () => {
  it("shows a stored photo immediately when the section panel enables it", () => {
    const preview = mergeResumeSectionDraft(profile, photoVisible);
    const visible = getResumeSemanticSection(preview.resumeSemanticSections, "photo").visible;
    expect(visible && getProfileMediaSource(preview.photoPath)).toBe(photo);
  });

  it("keeps the photo choice when the profile-data editor updates another field", () => {
    const preview = mergeResumeDataDraft({ ...profile, title: "Neue Position" }, photoVisible);
    expect(preview.title).toBe("Neue Position");
    expect(getResumeSemanticSection(preview.resumeSemanticSections, "photo").visible).toBe(true);
    expect(preview.photoPath).toBe(photo);
  });

  it("preserves a hidden photo when section changes are saved", () => {
    const hidden = mergeResumeSectionDraft(photoVisible, profile);
    expect(getResumeSemanticSection(hidden.resumeSemanticSections, "photo").visible).toBe(false);
    expect(hidden.photoPath).toBe(photo);
  });
});
