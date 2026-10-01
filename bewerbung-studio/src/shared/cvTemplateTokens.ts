// Every selectable template's native design, complete and typed. Each entry is defined next to the template's other
// constants (cvTemplateDefaults/*.defaults.ts); this file only registers them, so a template's number exists once.
import type { CvDesignTokens, NativeResumeDesign } from "./cvDesignSchema";
import { einspaltigDesign } from "./cvTemplateDefaults/einfach.defaults";
import { elegantDesign } from "./cvTemplateDefaults/elegant.defaults";
import { gepflegtDesign } from "./cvTemplateDefaults/gepflegt.defaults";
import { ivyLeagueDesign } from "./cvTemplateDefaults/ivy-league.defaults";
import { klassischDesign } from "./cvTemplateDefaults/klassisch.defaults";
import { kompaktDesign } from "./cvTemplateDefaults/kompakt.defaults";
import { kreativDesign } from "./cvTemplateDefaults/kreativ.defaults";
import { modernDesign } from "./cvTemplateDefaults/modern.defaults";
import { pehlioneWhiteBlueDesign, pehlioneWhiteDesign } from "./cvTemplateDefaults/pehlione.defaults";
import { stilvollDesign } from "./cvTemplateDefaults/stilvoll.defaults";
import { tabellarischDesign } from "./cvTemplateDefaults/tabellarisch.defaults";
import { zeitgenoessischDesign } from "./cvTemplateDefaults/zeitgenoessisch.defaults";
import { zweispaltigDesign } from "./cvTemplateDefaults/zweispaltig.defaults";

/** Native visual design of the standard rendering; density/ATS variations remain in their template adapters. */
export const nativeResumeDesigns: Record<string, NativeResumeDesign> = {
  modern: modernDesign,
  elegant: elegantDesign,
  gepflegt: gepflegtDesign,
  "ivy-league": ivyLeagueDesign,
  zweispaltig: zweispaltigDesign,
  zeitgenoessisch: zeitgenoessischDesign,
  kreativ: kreativDesign,
  tabellarisch: tabellarischDesign,
  einspaltig: einspaltigDesign,
  klassisch: klassischDesign,
  kompakt: kompaktDesign,
  stilvoll: stilvollDesign,
  pehlione_white_blue: pehlioneWhiteBlueDesign,
  pehlione_white: pehlioneWhiteDesign,
};

/** The semantic tokens alone, for callers that need no appearance. */
export const cvTemplateTokens: Record<string, CvDesignTokens> = Object.fromEntries(
  Object.entries(nativeResumeDesigns).map(([id, design]) => [id, design.tokens]),
);
