import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { profileSchema } from "./schema";
import { defaultDocumentDesign } from "./documentDesign";
import { applyResumeClosingOutput, resolveResumeClosingLine } from "./resumeClosing";

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
  it("prints place and the date of the application as Ort, DD.MM.YYYY", () => {
    expect(resolveResumeClosingLine(profile, "26.09.2026").text).toBe("Marburg, 26.09.2026");
    // The place is the explicit one, else the city of the profile.
    expect(resolveResumeClosingLine({ ...profile, applicationPlace: "", city: "Kassel" }, "26.09.2026").text).toBe("Kassel, 26.09.2026");
    // Only what is checked is printed.
    expect(resolveResumeClosingLine({ ...profile, resumeClosing: { ...profile.resumeClosing, showDate: false } }, "26.09.2026").text).toBe("Marburg");
    expect(resolveResumeClosingLine({ ...profile, resumeClosing: { ...profile.resumeClosing, showPlace: false } }, "26.09.2026").text).toBe("26.09.2026");
    // A template that passes no date keeps the date typed into the profile.
    expect(resolveResumeClosingLine(profile).text).toBe("Marburg, 2026-09-28");
    expect(resolveResumeClosingLine(profile, undefined, (value) => value.split("-").reverse().join(".")).text).toBe("Marburg, 28.09.2026");
    // An application without a readable date prints the place alone.
    expect(resolveResumeClosingLine(profile, "").text).toBe("Marburg");
  });
  it("draws the date of the application, not the profile date, when the template passes one", () => {
    const document = page();
    const root = document.querySelector(".cv-sheet")!;
    applyResumeClosingOutput(root, root.querySelector("main")!, profile, "pehlione_white_blue", {
      ...defaultDocumentDesign, resumePresentation: { closing: { placement: "main" } },
    }, true, true, undefined, "26.09.2026");
    expect(root.querySelector("[data-resume-closing-date]")?.textContent).toBe("26.09.2026");
    expect(root.querySelector("[data-resume-closing-place]")?.textContent).toBe("Marburg");
  });
});
