import { readFile, writeFile } from "node:fs/promises";
import { describe, it } from "vitest";
import { buildDocumentHtml } from "./documents";
import { createDocumentDesignDraft, selectDocumentTemplate } from "../src/shared/documentEditorState";
import type { Application, ApplicantProfile } from "../src/shared/schema";

describe("temporary Temmler restore diagnostic", () => {
  it("renders the previously selected Zweispaltig profile", async () => {
    const root = "D:/bewerbung_mustafa/data";
    const application = JSON.parse(await readFile(`${root}/Bewerbungen/Temmler_Pharma_GmbH_2026-09-29_2/bewerbung.json`, "utf8")) as Application;
    const workspace = JSON.parse(await readFile(`${root}/Setting/Settings/workspace.json`, "utf8")) as { profiles: ApplicantProfile[] };
    const profile = workspace.profiles.find(({ id }) => id === "6b4e78eb-56f7-47fd-ab71-7db7eb96b226");
    if (!profile) throw new Error("Previous profile missing");
    const design = selectDocumentTemplate(createDocumentDesignDraft(application), "zweispaltig");
    const restored = { ...application, templateId: design.templateId, profileId: profile.id,
      accentColor: design.accentColor, secondaryColor: design.secondaryColor,
      designSettings: { ...design.settings, resumePresentation: {
        ...design.settings.resumePresentation,
        sections: { ...design.settings.resumePresentation?.sections, photo: { visible: true } },
      } }, templateDesigns: design.templateDesigns };
    const output = "D:/bewerbung/bewerbung-studio/tmp/pdfs/continuation-contact";
    await writeFile(`${output}/temmler-restored.html`, buildDocumentHtml(restored, profile, "lebenslauf"));
    await writeFile(`${output}/temmler-restored-design.json`, JSON.stringify({
      templateId: restored.templateId, profileId: restored.profileId,
      accentColor: restored.accentColor, secondaryColor: restored.secondaryColor,
      designSettings: restored.designSettings, templateDesigns: restored.templateDesigns,
    }, null, 2));
  });
});
