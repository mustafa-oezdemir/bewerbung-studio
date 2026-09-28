import type { DocumentDesignSettings } from "./documentDesign";
import { resumeAppearanceSchema } from "./resumeAppearance";

/** Pehlione White Blue consumes the same saved design on both HTML surfaces. */
export const applyPehlioneAppearance = (root: Element, templateId: string, settings: DocumentDesignSettings) => {
  if (templateId !== "pehlione_white_blue") return;
  const appearance = resumeAppearanceSchema.parse(settings.resumeAppearance ?? {});
  const colors = settings.cvOverrides?.colors;
  const host = root.matches(".pehlione-resume,.pehlione-pdf")
    ? root
    : root.querySelector(".pehlione-resume,.pehlione-pdf");
  if (!host) return;
  const style = (host as HTMLElement).style;
  const values: Record<string, string | undefined> = {
    "--pehlione-sidebar-background": appearance.sidebarBackgroundColor,
    "--pehlione-sidebar-text": appearance.sidebarTextColor,
    "--pehlione-main-background": appearance.mainBackgroundColor,
    "--pehlione-title-color": colors?.heading,
    "--pehlione-subtitle-color": colors?.subheading,
    "--pehlione-section-color": colors?.sectionHeading,
    "--pehlione-entry-color": colors?.entryHeading,
    "--pehlione-divider-color": colors?.divider,
    "--pehlione-divider-width": appearance.sectionDividerWidthMm === undefined ? undefined : `${appearance.sectionDividerWidthMm}mm`,
    "--pehlione-photo-decoration-color": appearance.photoDecorationColor,
    "--pehlione-contact-divider-color": appearance.contactDividerColor,
  };
  for (const [name, value] of Object.entries(values)) if (value !== undefined) style.setProperty(name, value);
  if (appearance.sectionDividerVisible === false) host.setAttribute("data-section-divider", "hidden");
  if (appearance.photoDecorationVisible === false) host.setAttribute("data-photo-decoration", "hidden");
};

export const pehlioneAppearanceCss = `
[data-custom-template="pehlione_white_blue"].pehlione-main-section>[data-custom-role="heading"],
[data-custom-template="pehlione_white_blue"].pehlione-pdf-section>[data-custom-role="heading"]{display:grid;grid-template-columns:9mm minmax(0,1fr);gap:3mm;align-items:center}
[data-custom-template="pehlione_white_blue"]>[data-custom-role="heading"]>[data-custom-role="heading-label"]{grid-column:2;grid-row:1;min-width:0}
[data-custom-template="pehlione_white_blue"]>[data-custom-role="heading"]>[aria-hidden="true"]{grid-column:1;grid-row:1}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-sidebar,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-sidebar{background:var(--pehlione-sidebar-background,linear-gradient(155deg,#062e64,#0b3d86 58%,#041f45));color:var(--pehlione-sidebar-text,#fff)}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero.with-photo{background-color:#062b5a;background-image:linear-gradient(#ffffff1e 1px,transparent 1px),linear-gradient(90deg,#ffffff1e 1px,transparent 1px);background-size:4mm 4mm}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero:before,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero:after{position:absolute;display:block;border:.25mm solid var(--pehlione-photo-decoration-color,#b7d7ff99);border-radius:50%;content:"";transform:none}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero:before{top:8mm;left:10mm;width:28mm;height:28mm}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero:after{top:14mm;left:16mm;width:16mm;height:16mm}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero i{position:absolute;top:22mm;left:9mm;width:34mm;border-top:.25mm solid var(--pehlione-photo-decoration-color,#d9ebff99);transform:rotate(var(--angle,0deg));transform-origin:left}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero i:nth-of-type(1){--angle:-27deg}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero i:nth-of-type(2){--angle:18deg}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero i:nth-of-type(3){top:11mm;left:29mm;--angle:52deg}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero b{position:absolute;top:17mm;left:21mm;color:#d9ebff;font-size:9mm;font-weight:400}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-main,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-main{background:var(--pehlione-main-background,#fff)}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-header h1,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-header h1{color:var(--pehlione-title-color,var(--pehlione-primary))}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-header h2,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-header h2{color:var(--pehlione-subtitle-color,#12294e)}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-main .pehlione-section-heading,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-section>h3{color:var(--pehlione-section-color,var(--pehlione-primary))}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-career-entry h3,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-entry h4{color:var(--pehlione-entry-color,var(--pehlione-primary))}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-section-heading b,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-section>h3 span,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-sidebar h3{border-bottom-color:var(--pehlione-divider-color,var(--pehlione-primary));border-bottom-width:var(--pehlione-divider-width,.3mm)}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-sidebar .pehlione-language-heading{display:grid;grid-template-columns:9mm minmax(0,1fr);gap:3mm;align-items:center}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-sidebar .pehlione-language-heading>span{display:grid;width:9mm;height:9mm;place-items:center;border-radius:1.2mm;color:#fff;background:var(--pehlione-primary,#0b3d86)}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-sidebar .pehlione-language-heading b{display:block;min-width:0;padding-bottom:1.2mm;border-bottom-color:var(--pehlione-divider-color,var(--pehlione-primary));border-bottom-width:var(--pehlione-divider-width,.3mm)}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-sidebar .pehlione-pdf-language-heading{display:grid;grid-template-columns:9mm minmax(0,1fr);gap:3mm;align-items:center;border-bottom:0;padding-bottom:0}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-sidebar .pehlione-pdf-language-heading>i{display:grid;width:9mm;height:9mm;place-items:center;border-radius:1.2mm;color:#fff;background:var(--pehlione-primary,#0b3d86)}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-sidebar .pehlione-pdf-language-heading>span{display:block;min-width:0;padding-bottom:1.2mm;border-bottom:var(--pehlione-divider-width,.3mm) solid var(--pehlione-divider-color,var(--pehlione-primary))}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-contacts.pehlione-contacts h3,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-sidebar .pehlione-contacts.pehlione-contacts h3{border-bottom-color:var(--pehlione-contact-divider-color,#fff);border-bottom-width:var(--pehlione-divider-width,.3mm)}
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-sidebar .pehlione-pdf-section>h3{border-bottom:0;padding-bottom:0}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-header,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-header{border-bottom-color:var(--pehlione-divider-color,var(--pehlione-primary))}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-career-entry,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-entry{border-bottom-color:var(--pehlione-divider-color,#b8c3d0)}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-career-entry,
.pehlione-resume[data-template="pehlione_white_blue"][data-density="compact"] .pehlione-career-entry,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-entry{grid-template-columns:30mm minmax(0,1fr);gap:3mm;align-items:start}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-career-entry__meta,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-entry__meta{min-width:0}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-career-entry__period,
.pehlione-resume[data-template="pehlione_white_blue"][data-density="compact"] .pehlione-career-entry__period,
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-career-entry h3,
.pehlione-resume[data-template="pehlione_white_blue"][data-density="compact"] .pehlione-career-entry h3,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-entry__meta>p,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-entry h4{margin:0;font-size:9pt;line-height:1.2;font-weight:700}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-career-entry__period,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-entry__meta>p{white-space:nowrap}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-career-entry__location,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-entry__meta>small{display:block;margin-top:1mm;color:#1e3150;font-size:8.2pt;line-height:1.25}
.pehlione-resume[data-template="pehlione_white_blue"] [data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"],
.cv-sheet[data-template="pehlione_white_blue"] [data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"]{grid-template-columns:30mm minmax(0,1fr)!important}
.pehlione-resume[data-template="pehlione_white_blue"] [data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"] :is([data-resume-metadata-date],[data-resume-metadata-role]),
.cv-sheet[data-template="pehlione_white_blue"] [data-resume-metadata-grid="side-by-side"][data-resume-metadata-order="dates-first"] :is([data-resume-metadata-date],[data-resume-metadata-role]){font-size:9pt;line-height:1.2;text-align:left}
.pehlione-resume[data-section-divider="hidden"] .pehlione-section-heading b,
.pehlione-resume[data-section-divider="hidden"] .pehlione-language-heading b,
.pehlione-resume[data-section-divider="hidden"] .pehlione-sidebar h3,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf[data-section-divider="hidden"] .pehlione-pdf-section>h3 span,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf[data-section-divider="hidden"] .pehlione-pdf-language-heading>span,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf[data-section-divider="hidden"] .pehlione-pdf-sidebar h3{border-bottom:0}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-hero:before,
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-hero:after{border-color:var(--pehlione-photo-decoration-color,#b7d7ff99)}
.pehlione-resume[data-template="pehlione_white_blue"] .pehlione-hero :is(i),
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf-hero:after{border-color:var(--pehlione-photo-decoration-color,#d9ebff99)}
.pehlione-resume[data-photo-decoration="hidden"] .pehlione-hero :is(i),
.pehlione-resume[data-photo-decoration="hidden"] .pehlione-hero:before,
.pehlione-resume[data-photo-decoration="hidden"] .pehlione-hero:after,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf[data-photo-decoration="hidden"] .pehlione-pdf-hero:before,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf[data-photo-decoration="hidden"] .pehlione-pdf-hero:after,
.cv-sheet[data-template="pehlione_white_blue"] .pehlione-pdf[data-photo-decoration="hidden"] .pehlione-pdf-hero i{display:none}
`;
