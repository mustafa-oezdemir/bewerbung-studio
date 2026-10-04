import { describe, expect, it } from "vitest";
import { inheritResumeSectionStyles, resumeSectionStyleSources } from "./resumeSectionStyleInheritance";
import { readFileSync } from "node:fs";
import { templates } from "./templates";

describe("custom section style inheritance", () => {
  it("emits only scoped aliases so native templates retain their original cascade", () => {
    const output = inheritResumeSectionStyles('.modern-section__title{color:var(--heading)}.native-only{padding:10px}@media print{.modern-section{break-inside:avoid}}', "modern", "preview", true);
    expect(output).not.toContain(".modern-section__title");
    expect(output).not.toContain(".native-only");
    expect(output).toContain('data-custom-role="heading"');
    expect(output).toContain('@media print{[data-custom-template="modern"]{break-inside:avoid}}');
  });
  it.each(templates)("inherits native heading, entry and section declarations for $name", ({ id }) => {
    const path = id === "einspaltig" ? "einspaltig/einfach" : id.startsWith("pehlione_") ? "pehlione/pehlione" : `${id}/${id}`;
    const css = readFileSync(new URL(`../components/resume/templates/${path}.css`, import.meta.url), "utf8");
    const output = inheritResumeSectionStyles(css, id, "preview");
    expect(output).toContain(`data-custom-template="${id}"`);
    for (const role of ["heading", "entry-title", "entry"]) expect(output).toContain(`data-custom-role="${role}"`);
    if (id === "modern") for (const role of ["supporting", "metadata"]) expect(output).toContain(`data-custom-role="${role}"`);
    const source = resumeSectionStyleSources.preview[id as keyof typeof resumeSectionStyleSources.preview][1];
    const declarations = css.slice(css.indexOf(source)).match(/\{([^}]+)\}/)![1];
    expect(output).toContain(declarations);
  });
  it("retains ATS/density contexts and native declarations without changing them", () => {
    const css = '.modern-section__title{color:var(--heading);border-bottom:1px solid red}@media print{.modern-resume-ats .modern-section__title{font-size:10pt}}';
    const output = inheritResumeSectionStyles(css, "modern", "preview");
    expect(output).toContain('.modern-section__title{color:var(--heading);border-bottom:1px solid red}');
    expect(output).toContain('.modern-resume-ats :where([data-custom-template="modern"]) [data-custom-role="heading"]{font-size:10pt}');
    expect(output).toContain('@media print{');
  });
  it("inherits entry spacing and last-entry rules without importing career column geometry", () => {
    const output = inheritResumeSectionStyles('.pehlione-pdf-entry{display:grid;grid-template-columns:29mm 1fr;padding-bottom:4mm;break-inside:avoid}.pehlione-pdf-entry:last-child{padding-bottom:0;border-bottom:0}', "pehlione_white", "pdf");
    expect(output).toContain('[data-custom-role="entry"]{padding-bottom:4mm;break-inside:avoid}');
    expect(output).toContain('[data-custom-role="entry"]:last-child{padding-bottom:0;border-bottom:0}');
    expect(output).not.toMatch(/data-custom-role="entry"[^{}]*\{[^}]*grid-template/);
  });
  it("keeps adjacent-entry spacing inside the same custom section", () => {
    const output = inheritResumeSectionStyles('.pehlione-pdf-entry+.pehlione-pdf-entry{padding-top:4mm}', "pehlione_white", "pdf", true);
    expect(output).toContain(':where([data-custom-template="pehlione_white"]) [data-custom-role="entry"]+[data-custom-role="entry"]{padding-top:4mm}');
  });
});
