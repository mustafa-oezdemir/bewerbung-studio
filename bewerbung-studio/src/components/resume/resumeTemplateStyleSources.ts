import modernStyles from "./templates/modern/modern.css?raw";
import elegantStyles from "./templates/elegant/elegant.css?raw";
import zweispaltigStyles from "./templates/zweispaltig/zweispaltig.css?raw";
import zeitgenoessischStyles from "./templates/zeitgenoessisch/zeitgenoessisch.css?raw";
import kreativStyles from "./templates/kreativ/kreativ.css?raw";
import gepflegtStyles from "./templates/gepflegt/gepflegt.css?raw";
import kompaktStyles from "./templates/kompakt/kompakt.css?raw";
import stilvollStyles from "./templates/stilvoll/stilvoll.css?raw";
import einspaltigStyles from "./templates/einspaltig/einfach.css?raw";
import klassischStyles from "./templates/klassisch/klassisch.css?raw";
import tabellarischStyles from "./templates/tabellarisch/tabellarisch.css?raw";
import ivyLeagueStyles from "./templates/ivy-league/ivy-league.css?raw";
import pehlioneStyles from "./templates/pehlione/pehlione.css?raw";
import pehlioneWhiteStyles from "./templates/pehlione/pehlione-white.css?raw";
export const resumeTemplateStyleSources: Record<string, string> = {
  "modern": modernStyles,
  "elegant": elegantStyles,
  "zweispaltig": zweispaltigStyles,
  "zeitgenoessisch": zeitgenoessischStyles,
  "kreativ": kreativStyles,
  "gepflegt": gepflegtStyles,
  "kompakt": kompaktStyles,
  "stilvoll": stilvollStyles,
  "einspaltig": einspaltigStyles,
  "klassisch": klassischStyles,
  "tabellarisch": tabellarischStyles,
  "ivy-league": ivyLeagueStyles,
  "pehlione_white": pehlioneStyles + pehlioneWhiteStyles,
  "pehlione_white_blue": pehlioneStyles,
};
