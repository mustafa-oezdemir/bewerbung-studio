import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  appType: "custom",
  server: { middlewareMode: true },
});

try {
  const { resolveApplicationPaths } = await vite.ssrLoadModule(
    "/src/config/application-paths.ts",
  );
  const { TemplateService } = await vite.ssrLoadModule(
    "/electron/templates/template.service.ts",
  );
  const root = path.resolve("tmp", "klassisch-word-qa-v2");
  const paths = resolveApplicationPaths(
    root,
    path.resolve("public", "templates"),
  );
  const service = new TemplateService(paths);
  await service.initialize();
  const targetDirectory = path.join(
    paths.dataRoot,
    "Bewerbungen",
    "Klassisch-QA",
    "Lebenslauf",
  );
  const data = {
    VORNAME: "Julian",
    NACHNAME: "Fischer",
    BERUFSBEZEICHNUNG: "Oberkellner",
    FACHGEBIETE: "Japanische Kultur | Teamführung",
    TELEFON: "+49 30 12345678",
    EMAIL: "julianfischer@web.de",
    LINKEDIN: "linkedin.com/in/julian-fischer",
    WEBSITE: "julian-fischer.de",
    ORT: "München, Bayern",
    HEADER_KONTAKT_1: "+49 30 12345678",
    HEADER_KONTAKT_2: "julianfischer@web.de",
    HEADER_KONTAKT_3: "linkedin.com/in/julian-fischer",
    HEADER_KONTAKT_4: "München, Bayern",
    HEADER_KONTAKT_5: "Geb. 01.03.1990 in München",
    HEADER_KONTAKT_6: "julian-fischer.de",
    KONTAKT_ZEILE_1:
      "+49 30 12345678 · julianfischer@web.de · linkedin.com/in/julian-fischer",
    KONTAKT_ZEILE_2: "München, Bayern · Geb. 01.03.1990 in München",
    KONTAKT_ZEILE_3: "julian-fischer.de",
    ZUSAMMENFASSUNG_TITEL: "ZUSAMMENFASSUNG",
    ZUSAMMENFASSUNG:
      "Erfahrener Oberkellner mit über 7 Jahren Erfahrung in führenden Restaurants. Experte in der japanischen Kultur und Küche, mit bewährten Fähigkeiten in Teamführung und Kundenbeziehungsmanagement. Stolz auf die erfolgreiche Schulung von über 50 Mitarbeitenden und die Einführung wirksamer Qualitätsstandards.",
    STAERKEN_TITEL: "STÄRKEN",
    STAERKEN_ATS:
      "Teamleitung – Führung von Teams mit bis zu 30 Mitarbeitenden\nKommunikation – Effektive Abstimmung mit Küche und Management\nKonfliktmanagement – Professionelle Lösung von Kundenbeschwerden",
    STAERKE_1_TITEL: "Teamleitung",
    STAERKE_1_BESCHREIBUNG:
      "Erfolgreiche Führung von Teams mit bis zu 30 Mitarbeitenden.",
    STAERKE_2_TITEL: "Kommunikation",
    STAERKE_2_BESCHREIBUNG:
      "Effektive Abstimmung mit Küchen- und Managementteams.",
    STAERKE_3_TITEL: "Konfliktmanagement",
    STAERKE_3_BESCHREIBUNG:
      "Professionelle Lösung von Kundenbeschwerden.",
    ERFAHRUNG_TITEL: "ERFAHRUNG",
    BERUFSERFAHRUNG_TITEL: "BERUFSERFAHRUNG",
    POSITION_1: "Stellvertretender Restaurantleiter",
    UNTERNEHMEN_1: "Sushi Palace",
    STARTDATUM_1: "2019",
    DATUM_TRENNER_1: " – ",
    ENDDATUM_1: "2023",
    METADATA_TRENNER_1: " · ",
    ARBEITSORT_1: "Düsseldorf",
    BESCHREIBUNG_1:
      "Verantwortung für das tägliche Geschäft und Unterstützung des Restaurantleiters.",
    ERFOLG_1_1:
      "Schulung von 25 neuen Mitarbeitenden im Kundenservice und in der Sicherheit.",
    ERFOLG_1_2:
      "Verbesserung der operativen Abläufe mit einer Effizienzsteigerung von 15 %.",
    ERFOLG_1_3:
      "Einführung eines Inventarsystems, das die Lebensmittelverschwendung um 20 % reduzierte.",
    POSITION_2: "Oberkellner",
    UNTERNEHMEN_2: "Miso Master",
    STARTDATUM_2: "2016",
    DATUM_TRENNER_2: " – ",
    ENDDATUM_2: "2019",
    METADATA_TRENNER_2: " · ",
    ARBEITSORT_2: "Berlin",
    BESCHREIBUNG_2:
      "Leitung des Serviceteams und Gewährleistung eines hochwertigen Kundenservice.",
    ERFOLG_2_1:
      "Einführung eines Schulungsprogramms mit 10 % höherer Kundenzufriedenheit.",
    ERFOLG_2_2:
      "Koordination von Veranstaltungen mit einem Umsatzanstieg von 30 %.",
    POSITION_3: "Service Manager",
    UNTERNEHMEN_3: "Tokyo Tisch",
    STARTDATUM_3: "2013",
    DATUM_TRENNER_3: " – ",
    ENDDATUM_3: "2016",
    METADATA_TRENNER_3: " · ",
    ARBEITSORT_3: "Hamburg",
    BESCHREIBUNG_3:
      "Verantwortung für die Serviceabteilung und die Abstimmung mit der Küchenleitung.",
    ERFOLG_3_1:
      "Umsetzung von Qualitätsstandards mit 20 % höherer Kundenzufriedenheit.",
    AUSBILDUNG_TITEL: "AUSBILDUNG",
    ABSCHLUSS_1: "Master in Hotel- und Restaurantmanagement",
    HOCHSCHULE_1: "Technische Universität München",
    AUSBILDUNG_START_1: "2011",
    AUSBILDUNG_DATUM_TRENNER_1: " – ",
    AUSBILDUNG_ENDE_1: "2013",
    AUSBILDUNG_METADATA_TRENNER_1: " · ",
    AUSBILDUNG_ORT_1: "München",
    ABSCHLUSS_2: "Bachelor in Gastgewerbemanagement",
    HOCHSCHULE_2: "Universität Heidelberg",
    AUSBILDUNG_START_2: "2008",
    AUSBILDUNG_DATUM_TRENNER_2: " – ",
    AUSBILDUNG_ENDE_2: "2011",
    AUSBILDUNG_METADATA_TRENNER_2: " · ",
    AUSBILDUNG_ORT_2: "Heidelberg",
    KENNTNISSE_TITEL: "KENNTNISSE",
    KENNTNISSE:
      "Qualitätskontrolle · Hygienevorschriften · Serviceorientierung",
    SPRACHEN_TITEL: "SPRACHEN",
    SPRACHEN_ATS: "Deutsch – Muttersprache\nEnglisch – Versiert",
    SPRACHE_1: "Deutsch",
    SPRACHNIVEAU_1: "Muttersprache",
    SPRACHE_2: "Englisch",
    SPRACHNIVEAU_2: "Versiert",
    ZERTIFIKATE_TITEL: "ZERTIFIKATE",
    DESIGN_PRIMARY: "#2B2F32",
    DESIGN_ACCENT: "#00AFC5",
    DESIGN_SOFT_ACCENT: "#CDEFF3",
    DESIGN_FONT: "Arial",
    PROFILFOTO:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  };
  const visual = await service.createDocumentFromTemplate(
    "word-lebenslauf-klassisch",
    targetDirectory,
    "ignored",
    data,
  );
  const ats = await service.createDocumentFromTemplate(
    "word-lebenslauf-klassisch",
    path.join(targetDirectory, "ATS"),
    "ignored",
    data,
    { atsMode: true },
  );
  const outputDirectory = path.resolve("output", "docx");
  await mkdir(outputDirectory, { recursive: true });
  const visualOutput = path.join(
    outputDirectory,
    "Klassisch_Lebenslauf_Vorschau.docx",
  );
  const atsOutput = path.join(
    outputDirectory,
    "Klassisch_Lebenslauf_ATS_Vorschau.docx",
  );
  await copyFile(visual.filePath, visualOutput);
  await copyFile(ats.filePath, atsOutput);
  process.stdout.write(`${visualOutput}\n${atsOutput}\n`);
} finally {
  await vite.close();
}
