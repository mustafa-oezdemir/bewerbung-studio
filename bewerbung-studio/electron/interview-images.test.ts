import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import type { ApplicationInput } from "../src/shared/schema";
import { DataStore } from "./storage";
import { addSyntheticProfile } from "./test-profile";
import { detectImageType, fetchInterviewImage, readInterviewImage } from "./interview-images";

const input = (company: string): ApplicationInput => ({
  company: { name: company, street: "", postalCode: "35037", city: "Marburg", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: {
    title: "Maschinen-Einrichter", reference: "", source: "", url: "", fullText: "", workModel: "Vor Ort",
    contractType: "Unbefristet", salaryExpectation: "",
  },
  templateId: "classic-professional",
  accentColor: "#155e58",
  secondaryColor: "#244766",
  designSettings: defaultDocumentDesign,
  notes: "",
});

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24, 1)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(24, 2)]);
const coverall = "https://images.openai.com/static-rsc-4/coverall?purpose=inline";
const hairnet = "https://images.openai.com/static-rsc-4/hairnet?purpose=inline";
const broken = "https://images.openai.com/static-rsc-4/broken?purpose=inline";

const pasted = [
  "Frage 1: Welche Schutzkleidung wird getragen?",
  "",
  "Erklärung: Hygiene ist wichtig.",
  "",
  "Antwort: Typische Beispiele:",
  "",
  "Typische Schutzkleidung in der Pharmaproduktion",
  "",
  `[GammaGuard CE Sterile Coveralls – Cleanroom & Biotech PPE](${coverall})`,
  "",
  "Schutzkittel",
  "",
  `[Haarnetjes Wit 530mm | Brada](${hairnet})`,
  "",
  "Haarnetz",
  "",
  `[Defekt](${broken})`,
  "",
  "Defektes Bild",
].join("\n");

describe("Vorstellungsgespräch images", () => {
  let root: string;
  let store: DataStore;
  let requested: string[];

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbung-interview-images-"));
    store = new DataStore(root);
    await store.initialize();
    await addSyntheticProfile(store);
    requested = [];
    store.interviewImageFetcher = async (url) => {
      requested.push(url);
      if (url === coverall) return png;
      if (url === hairnet) return jpeg;
      return Buffer.from("<html>kein Bild</html>");
    };
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const createInterview = async () => {
    const created = (await store.createApplication(input("Temmler Pharma GmbH"))).applications[0];
    await store.changeStatus(created.id, "Vorstellungsgespräch");
    await store.saveApplication({ ...store.getApplication(created.id), interviewAt: new Date(2026, 9, 26, 9).toISOString() });
    return store.getApplication(created.id);
  };

  it("downloads the images once into Bilder/ and saves the note with the local files", async () => {
    const application = await createInterview();
    const prepared = await store.prepareInterviewImages(application.id, pasted);
    expect(prepared.images).toEqual({ saved: 2, failed: ["Defekt"] });
    expect(requested).toEqual([coverall, hairnet, broken]);
    const folder = store.files.interviewPath(application);
    const files = (await readdir(path.join(folder, "Bilder"))).sort();
    expect(files).toHaveLength(2);
    expect(files[0]).toMatch(/^GammaGuard-CE-Sterile-Coveralls-[A-Za-z-]{1,9}_[0-9a-f]{10}\.png$/);
    expect(files[1]).toMatch(/^Haarnetjes-Wit-530mm-Brada_[0-9a-f]{10}\.jpg$/);
    expect(await readFile(path.join(folder, "Bilder", files[0]))).toEqual(png);

    const { file } = await store.createInterviewNote(application.id, prepared.text);
    const markdown = await readFile(path.join(folder, file.fileName), "utf8");
    expect(markdown).toContain(`![GammaGuard CE Sterile Coveralls – Cleanroom & Biotech PPE](Bilder/${files[0]} "Quelle: ${coverall}")`);
    expect(markdown).toContain(`![Haarnetjes Wit 530mm | Brada](Bilder/${files[1]} "Quelle: ${hairnet}")`);
    // A failed image stays a link and is not lost.
    expect(markdown).toContain(`[Defekt](${broken})`);

    // The panel reads the image through the main process as a data: URL.
    expect(await store.getInterviewImage(application.id, `Bilder/${files[0]}`))
      .toBe(`data:image/png;base64,${png.toString("base64")}`);
    await expect(store.getInterviewImage(application.id, "Bilder/../../Setting/Settings/workspace.json")).rejects.toThrow("nicht gefunden");
    await expect(store.getInterviewImage(application.id, "Bilder/fehlt_0123456789.png")).rejects.toThrow("Das Bild wurde nicht gefunden.");

    // Saving again downloads only what is still remote and keeps the files.
    requested.length = 0;
    const again = await store.prepareInterviewImages(application.id, markdown);
    expect(requested).toEqual([broken]);
    expect(again.images).toEqual({ saved: 0, failed: ["Defekt"] });
    expect(again.text).toBe(markdown);
  });

  it("refuses invalid text before downloading anything", async () => {
    const application = await createInterview();
    await expect(store.prepareInterviewImages(application.id, `Nur Text\n[Bild](${coverall})`))
      .rejects.toThrow("Es wurde keine Frage erkannt");
    expect(requested).toEqual([]);
  });

  it("reads only real images and never follows a symbolic name", async () => {
    const application = await createInterview();
    await store.prepareInterviewImages(application.id, pasted);
    const folder = store.files.interviewPath(application);
    await writeFile(path.join(folder, "Bilder", "Falsch_0123456789.png"), "<svg onload=alert(1)>");
    await expect(readInterviewImage(folder, "Bilder/Falsch_0123456789.png")).rejects.toThrow("nicht gefunden");
    expect(detectImageType(Buffer.from("GIF89a-----------"))?.mime).toBe("image/gif");
    expect(detectImageType(Buffer.from("<svg></svg>----------"))).toBeNull();
  });

  it("does not download from addresses outside the internet or without https", async () => {
    for (const address of [
      "http://images.openai.com/a.png", "https://127.0.0.1/a.png", "https://localhost/a.png", "https://[::1]/a.png",
      "https://user:pw@example.com/a.png", "https://intranet/a.png", "https://example.com:8443/a.png",
    ]) {
      await expect(fetchInterviewImage(address)).rejects.toThrow("image address not allowed");
    }
  });
});
