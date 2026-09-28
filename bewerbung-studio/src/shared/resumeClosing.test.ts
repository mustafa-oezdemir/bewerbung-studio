import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { profileSchema } from "./schema";
import { defaultDocumentDesign } from "./documentDesign";
import { applyResumeClosingOutput } from "./resumeClosing";

const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(),
  applicationPlace: "Marburg", applicationDate: "2026-09-28", signaturePath: "data:image/png;base64,AA==" });
const page = () => parseHTML('<section class="cv-sheet"><div class="page-content"><main><section data-managed-section="experience">Erfahrung</section></main><footer class="modern-pdf-footer">Seite 1</footer></div></section>').document;

describe("shared resume closing", () => {
  it("appears only on the final visible page and retains ordinary page footers", () => {
    const document = page();
    const root = document.querySelector(".cv-sheet")!;
    const main = root.querySelector("main")!;
    applyResumeClosingOutput(root, main, profile, "modern", defaultDocumentDesign, false, true);
    expect(root.querySelector("[data-resume-closing]")).toBeNull();
    applyResumeClosingOutput(root, main, profile, "modern", defaultDocumentDesign, true, false);
    expect(root.querySelector("[data-resume-closing]")).toBeNull();
    expect(root.querySelector(".modern-pdf-footer")?.textContent).toBe("Seite 1");
    applyResumeClosingOutput(root, main, profile, "modern", defaultDocumentDesign, true, true);
    expect(root.querySelector("[data-resume-closing]")).not.toBeNull();
  });
  it("uses only checked fields and a validated profile image", () => {
    const document = page();
    const root = document.querySelector(".cv-sheet")!;
    const changed = { ...profile, signaturePath: "javascript:alert(1)", resumeClosing: { showPlace: false, showDate: true, showSignature: true } };
    applyResumeClosingOutput(root, root.querySelector("main")!, changed, "modern", defaultDocumentDesign, true, true);
    expect(root.querySelector("[data-resume-closing-place]")).toBeNull();
    expect(root.querySelector("[data-resume-closing-date]")?.textContent).toBe("28.09.2026");
    expect(root.querySelector("[data-resume-closing-signature]")).toBeNull();
  });
  it("keeps Pehlione's distributed alignment when only its placement changes", () => {
    const document = page();
    const root = document.querySelector(".cv-sheet")!;
    applyResumeClosingOutput(root, root.querySelector("main")!, profile, "pehlione_white", {
      ...defaultDocumentDesign, resumePresentation: { closing: { placement: "main" } },
    }, true, true);
    expect(root.querySelector("[data-resume-closing]")?.getAttribute("data-resume-closing-align")).toBe("distributed");
  });
});
