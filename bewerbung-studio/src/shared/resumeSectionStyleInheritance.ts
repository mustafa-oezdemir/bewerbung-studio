import postcss from "postcss";
import { resolveTemplateId } from "./templates";
const roles = ["section", "heading", "entry-title", "supporting", "metadata", "entries", "entry"] as const;
// Native selectors are the contracts; values, density/ATS variants and CSS variables
// continue to come from each template's own stylesheet.
export const resumeSectionStyleSources = {
  "preview": {
    "modern": [
      ".modern-section",
      ".modern-section__title",
      ".modern-experience-entry__role",
      ".modern-experience-entry__company",
      ".modern-experience-entry__date",
      ".modern-experience-list",
      ".modern-experience-entry"
    ],
    "elegant": [
      ".elegant-section",
      ".elegant-section__title",
      ".elegant-career-entry__heading h3",
      ".elegant-career-entry__heading > div > p",
      ".elegant-career-entry__meta",
      ".elegant-career__list",
      ".elegant-career-entry"
    ],
    "zweispaltig": [
      ".zweispaltig-section",
      ".zweispaltig-section__title",
      ".zweispaltig-career-entry h3",
      ".zweispaltig-career-entry__organization",
      ".zweispaltig-career-entry__meta",
      ".zweispaltig-career__list",
      ".zweispaltig-career-entry"
    ],
    "zeitgenoessisch": [
      ".zeitgenoessisch-section",
      ".zeitgenoessisch-section-heading__title",
      ".zeitgenoessisch-career-entry__role-row h4",
      ".zeitgenoessisch-career-entry__top h3",
      ".zeitgenoessisch-career-entry__role-row span",
      ".zeitgenoessisch-career__list",
      ".zeitgenoessisch-career-entry"
    ],
    "kreativ": [
      ".kreativ-section",
      ".kreativ-section__title",
      ".kreativ-career-entry h3",
      ".kreativ-career-entry h4",
      ".kreativ-career-entry__meta",
      ".kreativ-career__list",
      ".kreativ-career-entry"
    ],
    "gepflegt": [
      ".gepflegt-section",
      ".gepflegt-section__title",
      ".gepflegt-entry__heading h3",
      ".gepflegt-entry__subheading strong",
      ".gepflegt-entry__heading span",
      ".gepflegt-entry-list",
      ".gepflegt-entry"
    ],
    "kompakt": [
      ".kompakt-section",
      ".kompakt-section__title",
      ".kompakt-career-entry h3",
      ".kompakt-career-entry__meta strong",
      ".kompakt-career-entry__heading time",
      ".kompakt-career__list",
      ".kompakt-career-entry"
    ],
    "stilvoll": [
      ".stilvoll-section",
      ".stilvoll-section__title",
      ".stilvoll-career h3",
      ".stilvoll-career__meta strong",
      ".stilvoll-career__heading time",
      ".stilvoll-career__list",
      ".stilvoll-career article"
    ],
    "einspaltig": [
      ".einfach-section",
      ".einfach-section__title",
      ".einfach-career h3",
      ".einfach-career h4",
      ".einfach-career__heading time",
      ".einfach-career > div",
      ".einfach-career article"
    ],
    "klassisch": [
      ".klassisch-section",
      ".klassisch-section__title",
      ".klassisch-career h3",
      ".klassisch-career h4",
      ".klassisch-career__heading > p",
      ".klassisch-career > div",
      ".klassisch-career article"
    ],
    "tabellarisch": [
      ".tabellarisch-section",
      ".tabellarisch-section__title",
      ".tabellarisch-timeline-entry__role",
      ".tabellarisch-timeline-entry__organization",
      ".tabellarisch-timeline-entry__date",
      ".tabellarisch-timeline",
      ".tabellarisch-timeline-entry"
    ],
    "ivy-league": [
      ".ivy-league-section",
      ".ivy-league-section__title",
      ".ivy-league-career-entry__role h4",
      ".ivy-league-career-entry__top h3",
      ".ivy-league-career-entry__role time",
      ".ivy-league-career__list",
      ".ivy-league-career-entry"
    ],
    "pehlione_white": [
      ".pehlione-main-section",
      ".pehlione-section-heading",
      ".pehlione-career-entry h3",
      ".pehlione-career-entry__organisation",
      ".pehlione-career-entry__period",
      ".pehlione-career-list",
      ".pehlione-career-entry"
    ],
    "pehlione_white_blue": [
      ".pehlione-main-section",
      ".pehlione-section-heading",
      ".pehlione-career-entry h3",
      ".pehlione-career-entry__organisation",
      ".pehlione-career-entry__period",
      ".pehlione-career-list",
      ".pehlione-career-entry"
    ]
  },
  "pdf": {
    "modern": [
      ".modern-pdf-section",
      ".modern-pdf-title",
      ".modern-pdf-entry h3",
      ".modern-pdf-entry-meta strong",
      ".modern-pdf-entry-meta",
      ".modern-pdf-list",
      ".modern-pdf-entry"
    ],
    "elegant": [
      ".elegant-pdf-section",
      ".elegant-pdf-section>h3",
      ".elegant-pdf-entry-head h4",
      ".elegant-pdf-entry-head p",
      ".elegant-pdf-entry-meta",
      ".elegant-pdf-list",
      ".elegant-pdf-entry"
    ],
    "zweispaltig": [
      ".zweispaltig-pdf-section",
      ".zweispaltig-pdf-section>h3",
      ".zweispaltig-pdf-entry h4",
      ".zweispaltig-pdf-entry-organization",
      ".zweispaltig-pdf-entry-meta",
      ".zweispaltig-pdf-list",
      ".zweispaltig-pdf-entry"
    ],
    "zeitgenoessisch": [
      ".zeit-pdf-section",
      ".zeit-pdf-heading h3",
      ".zeit-pdf-entry-role h5",
      ".zeit-pdf-entry-top h4",
      ".zeit-pdf-entry-role span",
      ".zeit-pdf-list",
      ".zeit-pdf-entry"
    ],
    "kreativ": [
      ".kreativ-pdf-section",
      ".kreativ-pdf-title",
      ".kreativ-pdf-entry h4",
      ".kreativ-pdf-entry h5",
      ".kreativ-pdf-entry-meta",
      ".kreativ-pdf-list",
      ".kreativ-pdf-entry"
    ],
    "gepflegt": [
      ".gepflegt-pdf-section",
      ".gepflegt-pdf-title",
      ".gepflegt-pdf-entry-heading h4",
      ".gepflegt-pdf-entry-subheading strong",
      ".gepflegt-pdf-entry-heading span",
      ".gepflegt-pdf-list",
      ".gepflegt-pdf-entry"
    ],
    "kompakt": [
      ".managed-pdf-section",
      ".managed-pdf-title",
      ".kompakt-pdf-entry h3",
      ".kompakt-pdf-meta strong",
      ".kompakt-pdf-entry-heading time",
      ".managed-pdf-list",
      ".kompakt-pdf-entry"
    ],
    "stilvoll": [
      ".managed-pdf-section",
      ".managed-pdf-title",
      ".stilvoll-pdf-entry h3",
      ".stilvoll-pdf-meta strong",
      ".stilvoll-pdf-heading span",
      ".managed-pdf-list",
      ".stilvoll-pdf-entry"
    ],
    "einspaltig": [
      ".managed-pdf-section",
      ".managed-pdf-title",
      ".einfach-pdf-entry h3",
      ".einfach-pdf-entry h4",
      ".einfach-pdf-entry-heading time",
      ".managed-pdf-list",
      ".einfach-pdf-entry"
    ],
    "klassisch": [
      ".klassisch-pdf-section",
      ".klassisch-pdf-title",
      ".klassisch-pdf-entry h3",
      ".klassisch-pdf-entry h4",
      ".klassisch-pdf-entry-meta",
      ".klassisch-pdf-list",
      ".klassisch-pdf-entry"
    ],
    "tabellarisch": [
      ".tabellarisch-pdf-section",
      ".tabellarisch-pdf-title",
      ".tabellarisch-pdf-entry h3",
      ".tabellarisch-pdf-organization",
      ".tabellarisch-pdf-date",
      ".tabellarisch-pdf-timeline",
      ".tabellarisch-pdf-entry"
    ],
    "ivy-league": [
      ".ivy-pdf-section",
      ".ivy-pdf-title",
      ".ivy-pdf-entry-role h4",
      ".ivy-pdf-entry-top h3",
      ".ivy-pdf-entry-role span",
      ".ivy-pdf-list",
      ".ivy-pdf-entry"
    ],
    "pehlione_white": [
      ".pehlione-pdf-section",
      ".pehlione-pdf-section h3",
      ".pehlione-pdf-entry h4",
      ".pehlione-pdf-entry strong",
      ".pehlione-pdf-entry>p",
      "",
      ".pehlione-pdf-entry"
    ],
    "pehlione_white_blue": [
      ".pehlione-pdf-section",
      ".pehlione-pdf-section h3",
      ".pehlione-pdf-entry h4",
      ".pehlione-pdf-entry strong",
      ".pehlione-pdf-entry>p",
      "",
      ".pehlione-pdf-entry"
    ]
  }
} as const;

export const inheritResumeSectionStyles = (css: string, templateId: string, surface: "preview" | "pdf", aliasesOnly = false) => {
  const id = resolveTemplateId(templateId);
  const sources = resumeSectionStyleSources[surface][id as keyof typeof resumeSectionStyleSources.preview];
  if (!sources) return aliasesOnly ? "" : css;
  const scope = `[data-custom-template="${id}"]`;
  const roleSelector = (role: string) => `:where(${scope}) [data-custom-role="${role}"]`;
  // Match the browser's default weight for native heading/strong elements;
  // explicit template declarations below retain precedence.
  const supportingBold = /(?:h[1-6]|strong)$/.test(sources[3]);
  const defaults = supportingBold ? `${roleSelector("supporting")}{font-weight:bold}` : "";
  const contexts: string[][] = id === "modern" ? [[surface === "preview" ? ".modern-experience-entry__meta" : ".modern-pdf-entry-meta", "supporting"], [surface === "preview" ? ".modern-experience-entry__meta" : ".modern-pdf-entry-meta", "metadata"]] : [];
  if (id === "kompakt") contexts.push([surface === "preview" ? ".kompakt-career-entry__meta" : ".kompakt-pdf-meta", "supporting"], [surface === "preview" ? ".kompakt-career-entry__meta" : ".kompakt-pdf-meta", "metadata"]);
  if (id.startsWith("pehlione_") && surface === "pdf") contexts.push([".pehlione-pdf-entry p", "supporting"]);
  const contracts: string[][] = [...sources.map((source, index) => id === "tabellarisch" && roles[index] === "metadata"
    ? [source, roles[index], surface === "preview" ? '.tabellarisch-template:not([data-ats-mode="true"])' : ".tabellarisch-pdf:not(.tabellarisch-pdf-ats)"]
    : [source, roles[index]]), ...contexts];
  for (const [source, role] of [...contracts]) {
    const tag = source.match(/(?:^|[ >])([a-z][a-z0-9]*)$/)?.[1];
    if (tag && ["entry-title", "supporting", "metadata"].includes(role)) contracts.push([`${sources[6]} ${tag}`, role]);
  }
  if (id.startsWith("pehlione_") && surface === "preview") contracts.push([".pehlione-summary", "body"]);
  if (id.startsWith("pehlione_")) contracts.push([surface === "preview" ? ".pehlione-section-heading b" : ".pehlione-pdf-section h3 span", "heading-label"]);
  if (id === "zeitgenoessisch") contracts.push([surface === "preview" ? ".zeitgenoessisch-section-heading" : ".zeit-pdf-heading", "heading-wrapper"]);
  if (id === "tabellarisch") contracts.push(surface === "preview"
    ? [".tabellarisch-timeline-entry__ats-meta", "metadata", '.tabellarisch-template[data-ats-mode="true"]']
    : [".tabellarisch-pdf-ats-meta", "metadata", ".tabellarisch-pdf-ats"]);
  const sidebarSources: Record<string, [string, string]> = surface === "preview" ? {
    elegant: [".elegant-sidebar__title", ".elegant-sidebar"],
    gepflegt: [".gepflegt-sidebar__title", ".gepflegt-sidebar"],
  } : {
    elegant: [".elegant-pdf-sidebar section>h3", ".elegant-pdf-sidebar"],
    gepflegt: [".gepflegt-pdf-sidebar h3", ".gepflegt-pdf-sidebar"],
    pehlione_white: [".pehlione-pdf-sidebar h3", ".pehlione-pdf-sidebar"],
    pehlione_white_blue: [".pehlione-pdf-sidebar h3", ".pehlione-pdf-sidebar"],
  };
  const sidebar = sidebarSources[id];
  if (sidebar) contracts.push([sidebar[0], "heading", sidebar[1]]);
  const root = postcss.parse(css);
  const inheritedRules: Array<{ rule: postcss.Rule; selectors: string[]; declarations?: string }> = [];
  root.walkRules(rule => {
    const byDeclarations = new Map<string, Set<string>>();
    for (const selector of postcss.list.comma(rule.selector)) {
      for (const [source, role, context] of contracts) {
        if (!source) continue;
        const pseudo = selector.endsWith(source + ":last-child") ? ":last-child" : "";
        if (!selector.endsWith(source + pseudo)) continue;
        const prefix = selector.slice(0, -(source + pseudo).length) + (context ? context + " " : "");
        const tagCount = (source.match(/(?:^|[ >+~])(?:h[1-6]|p|div|span|strong|time|article|section)(?=$|[ >+~])/g) ?? []).length;
        const tags = ":is(h2,h3,h4,h5,p,div,span,strong,time,article,section)".repeat(tagCount);
        const target = role === "section" ? scope : roleSelector(role) + tags;
        const declarations = role === "entry"
          ? rule.nodes?.filter(node => node.type === "decl" && /^(?:margin|padding|border|break-|page-break|min-width|position)/.test(node.prop)).map(node => node.toString()).join(";") ?? ""
          : undefined;
        if (declarations === "") continue;
        let firstEntry = true;
        const alias = role === "entry"
          ? selector.replaceAll(source, () => {
              const replacement = firstEntry ? target : '[data-custom-role="entry"]';
              firstEntry = false;
              return replacement;
            })
          : prefix + target + pseudo;
        const key = declarations ?? "*";
        const selectors = byDeclarations.get(key) ?? new Set<string>();
        selectors.add(alias);
        byDeclarations.set(key, selectors);
      }
    }
    for (const [declarations, selectors] of byDeclarations) {
      inheritedRules.push({ rule, selectors: [...selectors], declarations: declarations === "*" ? undefined : declarations });
    }
  });
  for (const { rule, selectors, declarations } of inheritedRules) {
    const clone = rule.clone({ selector: selectors.join(",") });
    if (declarations !== undefined) {
      clone.removeAll();
      for (const node of rule.nodes ?? []) {
        if (node.type === "decl" && /^(?:margin|padding|border|break-|page-break|min-width|position)/.test(node.prop)) clone.append(node.clone());
      }
    }
    rule.after(clone);
  }
  if (aliasesOnly) {
    const originals = new Set(inheritedRules.map(({ rule }) => rule));
    root.walkRules(rule => { if (originals.has(rule) || !rule.selector.includes("data-custom-")) rule.remove(); });
    root.walkAtRules(rule => { if (!rule.nodes?.length) rule.remove(); });
  }
  return defaults + root.toString();
};
