import type { ApplicantProfile } from "./schema";
import type { DocumentDesignSettings } from "./documentDesign";
import { resumeSectionStyleSources } from "./resumeSectionStyleInheritance";
import { resolveTemplateId } from "./templates";
import { resolveEducationPresentation } from "./resumeEducation";
import { getCvDesignVariables, resolveCvDesign } from "./cvDesign";
import { resolveExperience } from "./resumeCareer";

export const resumeMetadataCss = `
[data-resume-metadata-entry]{display:block!important;min-width:0;break-inside:auto}
[data-resume-metadata-grid]{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,42%)!important;gap:.6mm 3mm;margin-bottom:var(--doc-entry-content-gap,1.5mm);min-width:0;align-items:start}
[data-resume-metadata-grid="stacked"]{grid-template-columns:minmax(0,1fr)!important}
[data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"]{grid-template-columns:minmax(0,42%) minmax(0,1fr)!important}
[data-resume-metadata-grid="stacked"] [data-resume-metadata-role]{grid-row:1}
[data-resume-metadata-grid="stacked"] [data-resume-metadata-organization]{grid-row:2}
[data-resume-metadata-grid="stacked"] [data-resume-metadata-date]{grid-row:3}
[data-resume-metadata-grid="stacked"] [data-resume-metadata-location]{grid-row:4}
[data-resume-metadata-grid="side-by-side"] [data-resume-metadata-role]{grid-column:1;grid-row:1}
[data-resume-metadata-grid="side-by-side"] [data-resume-metadata-organization]{grid-column:1;grid-row:2}
[data-resume-metadata-grid="side-by-side"] [data-resume-metadata-date]{grid-column:2;grid-row:1}
[data-resume-metadata-grid="side-by-side"] [data-resume-metadata-location]{grid-column:2;grid-row:2}
[data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"] [data-resume-metadata-role],
[data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"] [data-resume-metadata-organization]{grid-column:2}
[data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"] [data-resume-metadata-date],
[data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"] [data-resume-metadata-location]{grid-column:1}
[data-resume-metadata-grid]>*{display:block!important;margin:0!important;padding:0!important;min-width:0;overflow-wrap:anywhere;align-self:start!important}
[data-resume-metadata-role]{color:var(--doc-entry-heading-color,currentColor);font-size:var(--doc-entry-heading-size,1.08em);font-weight:700;line-height:1.2}
[data-resume-metadata-organization]{color:var(--doc-accent-color,currentColor);font-weight:600}
[data-resume-metadata-date],[data-resume-metadata-location]{color:var(--doc-muted-color,currentColor);font-size:.92em}
[data-resume-metadata-grid="side-by-side"] :is([data-resume-metadata-date],[data-resume-metadata-location]){text-align:right}
[data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"] :is([data-resume-metadata-date],[data-resume-metadata-location]){text-align:left}
[data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"] :is([data-resume-metadata-role],[data-resume-metadata-organization]){text-align:right}
`;

type Career = { role: string; company: string; city?: string; from: string; to: string };
const normalized = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");

/** Project the same career metadata for the React preview and the PDF HTML. */
export const applyResumeMetadataLayout = (
  page: Element,
  profile: ApplicantProfile,
  templateId: string,
  surface: "preview" | "pdf",
  settings: DocumentDesignSettings,
): void => {
  if (!settings.metadataLayout) return;
  const id = resolveTemplateId(templateId);
  const entrySelector = resumeSectionStyleSources[surface][id as keyof typeof resumeSectionStyleSources.preview]?.[6];
  if (!entrySelector) return;
  const variables = getCvDesignVariables(resolveCvDesign(id, settings.cvOverrides));
  const records: Record<string, Career[]> = {
    experience: profile.experiences.map(resolveExperience).map(item => ({ role: item.role, company: item.organization, city: item.location, from: item.from, to: item.to })),
    education: profile.education.map(item => {
      const view = resolveEducationPresentation(item);
      return { role: view.title, company: view.institution, city: view.location, from: view.from, to: view.to };
    }),
  };
  for (const kind of ["experience", "education"]) {
    const sections = page.querySelectorAll(`[data-managed-section="${kind}"]`);
    for (const section of sections) {
      const used = new Set<number>();
      const kindSelector = id === "modern" && kind === "education"
        ? entrySelector.replaceAll("experience", "education") : entrySelector;
      for (const entry of Array.from(section.querySelectorAll(kindSelector))) {
        if (entry.hasAttribute("data-resume-metadata-entry")) continue;
        const text = normalized(entry.textContent ?? "");
        const index = records[kind].findIndex((item, position) => !used.has(position)
          && text.includes(normalized(item.role)) && text.includes(normalized(item.company)));
        if (index < 0) continue;
        used.add(index);
        const item = records[kind][index];
        const body = Array.from(entry.querySelectorAll("ul,ol")).filter(node => {
          const parentList = node.parentElement?.closest("ul,ol");
          return !parentList || !entry.contains(parentList);
        });
        const details = Array.from(entry.querySelectorAll("p")).filter(node => !node.closest("ul,ol")
          && !node.querySelector("p,ul,ol") && ![item.role, item.company, item.city ?? "", item.from, item.to]
            .filter(Boolean).some(value => normalized(node.textContent ?? "").includes(normalized(value))));
        const grid = entry.ownerDocument.createElement("div");
        grid.setAttribute("data-resume-metadata-grid", settings.metadataLayout);
        grid.setAttribute("data-resume-metadata-order", settings.metadataOrder ?? "details-first");
        for (const key of ["--doc-entry-heading-color", "--doc-entry-heading-size", "--doc-accent-color", "--doc-muted-color"])
          (grid as HTMLElement).style.setProperty(key, variables[key]);
        const values = { role: item.role, organization: item.company, date: [item.from, item.to].filter(Boolean).join(" – "), location: item.city ?? "" };
        for (const [key, value] of Object.entries(values)) {
          if (!value) continue;
          const element = entry.ownerDocument.createElement(key === "role" ? "strong" : "span");
          element.setAttribute(`data-resume-metadata-${key}`, "");
          element.textContent = value;
          grid.appendChild(element);
        }
        entry.replaceChildren(grid, ...body.map(node => node.cloneNode(true)), ...details.map(node => node.cloneNode(true)));
        entry.setAttribute("data-resume-metadata-entry", kind);
      }
    }
  }
};
