import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const outputMode = process.argv[2] === "ats" ? "ats" : "visual";
const outputDirectory = path.resolve("tmp", "klassisch-qa");
await mkdir(outputDirectory, { recursive: true });

const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  appType: "custom",
  server: { middlewareMode: true },
});

try {
  const { buildDocumentHtml } = await vite.ssrLoadModule(
    "/electron/documents.ts",
  );
  const { applicationSchema, profileSchema } = await vite.ssrLoadModule(
    "/src/shared/schema.ts",
  );
  const { defaultDocumentDesign } = await vite.ssrLoadModule(
    "/src/shared/documentDesign.ts",
  );
  const now = new Date("2026-07-22T10:00:00.000Z").toISOString();
  const application = applicationSchema.parse({
    schemaVersion: 1,
    id: "d50ac50f-cafe-4ca3-b06b-a98b0bb1fa11",
    folderName: "Klassisch-QA",
    company: { name: "Beispiel GmbH", city: "Berlin" },
    contact: {},
    job: { title: "Oberkellner" },
    status: "Entwurf",
    templateId: "klassisch",
    accentColor: "#2B2F32",
    secondaryColor: "#00AFC5",
    designSettings: {
      ...defaultDocumentDesign,
      resumeOutputMode: outputMode,
      backgroundId: "classic-soft-blue-waves",
      showBackgroundInPrint: true,
      columnLayout: outputMode === "ats" ? "compact-ats" : "single",
    },
    documents: {
      resumeProfile:
        "Erfahrener Oberkellner mit über 7 Jahren Erfahrung in führenden Restaurants. Experte in der japanischen Kultur und Küche, mit bewährten Fähigkeiten in Teamführung und Kundenbeziehungsmanagement. Stolz auf die erfolgreiche Schulung von über 50 Mitarbeitenden und die Einführung wirksamer Qualitätsstandards.",
    },
    statusHistory: [],
    createdAt: now,
    updatedAt: now,
  });
  const profile = profileSchema.parse({
    id: "f42f1006-799c-48bc-a705-4fa4533b8ac8",
    isDefault: true,
    firstName: "Julian",
    lastName: "Fischer",
    title: "Oberkellner",
    city: "München",
    country: "Bayern",
    phone: "+49 30 12345678",
    email: "julianfischer@web.de",
    linkedin: "linkedin.com/in/julian-fischer",
    birthDate: "01.03.1990",
    birthPlace: "München",
    portfolio: "julian-fischer.de",
    photoPath:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    skills: [
      "Teamleitung – Erfolgreiche Führung von Teams mit bis zu 30 Mitarbeitenden, wobei hohe Motivation und Produktivität gewährleistet wurden.",
      "Kommunikation – Effektive Kommunikation mit Küchen- und Managementteams, was zu einer 95 %igen Einhaltung der Service-Standards führte.",
      "Konfliktmanagement – Lösung von über 100 Kundenbeschwerden pro Jahr mit einer Zufriedenheitsrate von 98 %.",
      "Qualitätskontrolle",
      "Hygienevorschriften",
      "Serviceorientierung",
    ],
    experiences: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        from: "2019",
        to: "2023",
        role: "Stellvertretender Restaurantleiter",
        company: "Sushi Palace",
        city: "Düsseldorf",
        achievements: [
          "Schulung von 25 neuen Mitarbeitenden im Kundenservice und in der Sicherheit.",
          "Verbesserung der operativen Abläufe mit einer Effizienzsteigerung von 15 %.",
          "Einführung eines Inventarsystems, das die Lebensmittelverschwendung um 20 % reduzierte.",
          "Führung eines Teams von 30 Mitarbeitenden in einem hoch bewerteten Restaurant.",
        ],
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        from: "2016",
        to: "2019",
        role: "Oberkellner",
        company: "Miso Master",
        city: "Berlin",
        achievements: [
          "Einführung eines Schulungsprogramms mit 10 % höherer Kundenzufriedenheit.",
          "Koordination von Veranstaltungen mit einem Umsatzanstieg von 30 %.",
          "Pflege der Kundenbeziehungen und Ausbau der Stammkundschaft um 25 %.",
        ],
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        from: "2013",
        to: "2016",
        role: "Service Manager",
        company: "Tokyo Tisch",
        city: "Hamburg",
        achievements: [
          "Umsetzung von Qualitätsstandards mit 20 % höherer Kundenzufriedenheit.",
          "Koordination mit der Küchenleitung und Verkürzung der Wartezeiten um 15 %.",
        ],
      },
    ],
    education: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        from: "2011",
        to: "2013",
        degree: "Master in Hotel- und Restaurantmanagement",
        institution: "Technische Universität München",
        city: "München",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        from: "2008",
        to: "2011",
        degree: "Bachelor in Gastgewerbemanagement",
        institution: "Universität Heidelberg",
        city: "Heidelberg",
      },
    ],
    languages: ["Deutsch – Muttersprache", "Englisch – Versiert"],
    certifications: [],
    updatedAt: now,
  });
  const outputPath = path.join(
    outputDirectory,
    `klassisch-${outputMode}.html`,
  );
  await writeFile(
    outputPath,
    buildDocumentHtml(application, profile, "lebenslauf"),
    "utf8",
  );
  process.stdout.write(outputPath);
} finally {
  await vite.close();
}
