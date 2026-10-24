import { describe, expect, it } from "vitest";
import { profileSchema, type ApplicantProfile, type Application } from "../shared/schema";
import { defaultDocumentDesign } from "../shared/documentDesign";
import { resolveCvDocument } from "../shared/resolveCvDocument";
import type { ResumePresentation } from "../shared/resumePresentationSchema";
import { analyzeKeywordMatch, includesKeywordPhrase } from "./keywordMatch";

const application = (tasksText: string, requirementsText: string) =>
  ({ job: { title: "Entwickler", fullText: "React im alten Text", tasksText, requirementsText } }) as Application;
/** A special-section entry with the fields the shared markup reads. */
const entry = (values: Record<string, unknown>) => ({ id: "e1", title: "", subtitle: "", from: "", to: "", date: "", location: "",
  url: "", description: "", bullets: [], technologies: [], ...values });
const profile = (values: Partial<ApplicantProfile> = {}) =>
  ({ skills: [], strengths: [], languages: [], education: [], resumeKnowledgeGroups: [],
    knowledgeSection: { isVisible: true, categories: [] }, ...values }) as ApplicantProfile;

describe("Stellenanzeigen-Match", () => {
  it("counts distinct requirements, never task or legacy text, with case insensitive aliases", () => {
    const result = analyzeKeywordMatch(
      application("TYPESCRIPT, SQL und Bootstrap", "typescript, Vue.js 3, Golang und sql. SQL erneut."),
      profile({ skills: ["TypeScript", "SQL", "Go", "Vue.js"] }),
    );
    expect(result.met.map((item) => item.label)).toEqual(["TypeScript", "Go", "SQL"]);
    expect(result.missing.map((item) => item.label)).toEqual(["Vue.js 3"]);
    expect(result.score).toBe(75);
    expect(result.matchedSkills).toEqual(["TypeScript", "Go", "SQL"]);
  });

  it("does not match Go inside another word or assume a Vue version", () => {
    expect(includesKeywordPhrase("Golang", "Go")).toBe(false);
    expect(includesKeywordPhrase("TypeScript", "TYPESCRIPT")).toBe(true);
    expect(includesKeywordPhrase("Vue.js", "vue js")).toBe(true);
    expect(analyzeKeywordMatch(application("", "Vue.js 3"), profile({ skills: ["Vue.js"] })).score).toBe(0);
  });

  it("uses visible saved knowledge and strengths once, including OOP aliases", () => {
    const result = analyzeKeywordMatch(application("", "Objektorientierte Programmierung, Docker, Kubernetes, React, Analytische Fähigkeiten"),
      profile({
        skills: ["OOP"],
        knowledgeSection: { isVisible: true, categories: [{ isVisible: true, items: [
          { isVisible: true, name: "Docker", sortOrder: 0 },
          { isVisible: false, name: "React", sortOrder: 1 },
        ], subcategories: [] }] } as unknown as ApplicantProfile["knowledgeSection"],
        resumeKnowledgeGroups: [{ visible: true, semanticType: "technologies", items: [{ visible: true, text: "Kubernetes" }] }] as ApplicantProfile["resumeKnowledgeGroups"],
        strengths: [{ title: "Analytische Fähigkeiten" }] as ApplicantProfile["strengths"],
      }));
    expect(result.score).toBe(80);
    expect(result.met).toHaveLength(4);
    expect(result.missing.map((item) => item.label)).toEqual(["React"]);
    expect(result.matchedSkills).toEqual(["Docker", "Kubernetes", "OOP"]);
  });

  it("checks language level and completed field of study separately from technical skills", () => {
    const ad = application("", "Abgeschlossenes Studium der Informatik\nSehr gute Deutschkenntnisse\nSQL");
    const insufficient = analyzeKeywordMatch(ad, profile({
      skills: ["SQL"], languages: ["Deutsch – A1"],
      education: [{ degree: "Bachelor", fieldOfStudy: "Informatik", to: "", status: "laufend" }] as ApplicantProfile["education"],
    }));
    expect(insufficient.score).toBe(33);
    expect(insufficient.missing.map((item) => item.kind)).toEqual(["language", "education"]);
    const qualified = analyzeKeywordMatch(ad, profile({
      skills: ["SQL"], languages: ["Deutsch – C1"],
      education: [{ degree: "Bachelor", fieldOfStudy: "Informatik", to: "2021", status: "abgeschlossen" }] as ApplicantProfile["education"],
    }));
    expect(qualified.score).toBe(100);
  });

  it("finds requirements in the whole Lebenslauf and the Anschreiben, not only in the knowledge lists", () => {
    const ad = application("", "Go, Docker, Kubernetes, Scrum, Prometheus, Analytische Fähigkeiten, React");
    const result = analyzeKeywordMatch(ad, profile({
      skills: ["Docker"],
      experiences: [{ role: "Prozessplaner", description: "Abstimmung im Scrum-Team", tasks: [], projects: [], technologies: [], achievements: [] }] as unknown as ApplicantProfile["experiences"],
      specialSections: [{ kind: "projects", title: "Projekte", isVisible: true, entries: [
        entry({ title: "Go Shipping & Returns Microservice", description: "Microservice mit Go und Gin.", technologies: ["Go", "Prometheus"] }),
      ] }] as unknown as ApplicantProfile["specialSections"],
      certifications: ["Certified Kubernetes Application Developer"],
    }), { summary: "Entwickler mit analytischen Fähigkeiten", coverLetter: "Mein analytisches Denken bringe ich gerne ein." });
    const evidence = Object.fromEntries(result.met.map((item) => [item.label, `${item.source} · ${item.evidence}`]));
    expect(evidence).toEqual({
      Go: "Lebenslauf · Projekt: Go Shipping & Returns Microservice",
      Scrum: "Lebenslauf · Werdegang: Prozessplaner",
      Docker: "Kenntnisse · Docker",
      Kubernetes: "Lebenslauf · Zertifikat: Certified Kubernetes Application Developer",
      "Analytische Fähigkeiten": "Anschreiben · Anschreiben",
      Prometheus: "Lebenslauf · Projekt: Go Shipping & Returns Microservice",
    });
    expect(result.missing.map((item) => item.label)).toEqual(["React"]);
    expect(result.matchedSkills).toEqual(["Go", "Scrum", "Docker", "Kubernetes", "Prometheus"]);
  });

  it("ignores hidden sections of the Lebenslauf", () => {
    const result = analyzeKeywordMatch(application("", "React"), profile({
      specialSections: [{ kind: "projects", title: "Projekte", isVisible: false, entries: [
        entry({ title: "Shop", description: "React-Frontend", technologies: ["React"] }),
      ] }] as unknown as ApplicantProfile["specialSections"],
    }));
    expect(result.missing.map((item) => item.label)).toEqual(["React"]);
  });

  it("ignores sections switched off in the Lebenslauf, by the profile or by the section manager", () => {
    const ad = application("", "Docker, Scrum, Kubernetes, Analytische Fähigkeiten, Python");
    const saved = profile({
      skills: ["Docker"],
      strengths: [{ title: "Analytische Fähigkeiten" }] as ApplicantProfile["strengths"],
      experiences: [{ role: "Entwickler", description: "Scrum-Team", tasks: [], projects: [], technologies: [], achievements: [] }] as unknown as ApplicantProfile["experiences"],
      certifications: ["Certified Kubernetes Application Developer"],
      specialSections: [{ id: "p1", kind: "projects", title: "Projekte", isVisible: true, entries: [
        entry({ title: "Data", description: "Python-Auswertung" }),
      ] }] as unknown as ApplicantProfile["specialSections"],
    });
    expect(analyzeKeywordMatch(ad, saved).score).toBe(100);
    const hiddenByProfile = analyzeKeywordMatch(ad, { ...saved, resumeSections: {
      profile: true, strengths: false, experience: false, education: true, skills: false, languages: true, certifications: false,
    } });
    expect(hiddenByProfile.met.map((item) => item.label)).toEqual(["Python"]);
    const hiddenByManager = analyzeKeywordMatch(ad, saved, { sections: [
      { id: "knowledge", visible: true }, { id: "experience", visible: true }, { id: "strengths", visible: true },
      { id: "certifications", visible: true }, { id: "special:p1", visible: false },
    ] });
    expect(hiddenByManager.missing.map((item) => item.label)).toEqual(["Python"]);
  });

  it("reads only the heading of a Kompakt station and not a hidden Kurzprofil", () => {
    const ad = application("", "Scrum, Docker, Python");
    const result = analyzeKeywordMatch(ad, profile({
      experiences: [{ role: "Python-Entwickler", compact: true, description: "Scrum-Team", tasks: [], projects: [],
        technologies: ["Docker"], achievements: [] }] as unknown as ApplicantProfile["experiences"],
    }), { summary: "Erfahrung mit Docker", sections: [{ id: "summary", visible: false }] });
    expect(result.met.map((item) => `${item.label} · ${item.evidence}`)).toEqual(["Python · Werdegang: Python-Entwickler"]);
  });

  it("shows no percentage for empty or uncheckable requirements", () => {
    expect(analyzeKeywordMatch(application("TypeScript", ""), profile({ skills: ["TypeScript"] })).score).toBeNull();
    const result = analyzeKeywordMatch(application("", "Reisebereitschaft"), profile());
    expect(result.score).toBeNull();
    expect(result.furtherReview).toContain("Reisebereitschaft");
  });
});

/** The Lebenslauf exactly as the preview projects it: resolveCvDocument, then the match on its result (as DocumentsView). */
describe("Stellenanzeigen-Match über die Vorschau des Lebenslaufs", () => {
  const now = "2026-10-18T09:00:00.000Z";
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const allSections = { profile: true, strengths: true, experience: true, education: true, skills: true, languages: true, certifications: true };
  const saved = (extra: Record<string, unknown> = {}) => profileSchema.parse({
    id: uuid(1), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Softwareentwicklerin", updatedAt: now, ...extra,
  });
  const preview = (requirements: string, source: ApplicantProfile, options: { presentation?: ResumePresentation; resumeProfile?: string } = {}) => {
    const cv = resolveCvDocument({
      profile: source, templateId: "modern", resumeProfile: options.resumeProfile,
      settings: { ...defaultDocumentDesign, resumePresentation: options.presentation },
    });
    return analyzeKeywordMatch(application("", requirements), cv.profile, {
      summary: cv.summary, sections: cv.managerSections, knowledgeGroups: cv.knowledgeGroups,
    });
  };
  const found = (result: ReturnType<typeof analyzeKeywordMatch>) =>
    Object.fromEntries(result.met.map((item) => [item.label, `${item.source} · ${item.evidence}`]));
  const missing = (result: ReturnType<typeof analyzeKeywordMatch>) => result.missing.map((item) => item.label);

  it("Kurzprofil: reads the text the preview prints, not the archived Bewerbung text", () => {
    const result = preview("Docker, Kubernetes", saved({ summary: "Erfahrung mit Docker" }), { resumeProfile: "Erfahrung mit Kubernetes" });
    expect(found(result)).toEqual({ Docker: "Lebenslauf · Kurzprofil" });
    expect(missing(result)).toEqual(["Kubernetes"]);
    expect(missing(preview("Kubernetes", saved({ summary: "Kubernetes", resumeSections: { ...allSections, profile: false } }))))
      .toEqual(["Kubernetes"]);
  });

  it("Beruflicher Werdegang: role, employer and every printed detail, not the hidden ones", () => {
    const station = { id: uuid(2), from: "2021", to: "2024", role: "Entwicklerin", company: "Python Software Foundation",
      description: "Betrieb der Plattform", tasks: ["Container mit Docker betreiben"], achievements: ["Scrum eingeführt"] };
    const visible = preview("Python, Docker, Scrum", saved({ experiences: [station] }));
    expect(found(visible)).toEqual({
      Python: "Lebenslauf · Werdegang: Entwicklerin",
      Docker: "Lebenslauf · Werdegang: Entwicklerin",
      Scrum: "Lebenslauf · Werdegang: Entwicklerin",
    });
    const tasksHidden = preview("Python, Docker, Scrum", saved({ experiences: [station],
      resumeCareerFieldVisibility: { tasks: false } }));
    expect(missing(tasksHidden)).toEqual(["Docker"]);
    const sectionHidden = preview("Python, Docker, Scrum", saved({ experiences: [station],
      resumeManagerOverrides: { experience: { visible: false } } }));
    expect(sectionHidden.met).toEqual([]);
  });

  it("Stärken: a strength named in the ad and the text of its description", () => {
    const strengths = [{ id: uuid(3), title: "Teamfähigkeit", description: "Moderiere Scrum-Retrospektiven" }];
    expect(found(preview("Teamfähigkeit, Scrum", saved({ strengths })))).toEqual({
      Scrum: "Lebenslauf · Stärke: Teamfähigkeit",
      Teamfähigkeit: "Stärken · Teamfähigkeit",
    });
    expect(preview("Teamfähigkeit, Scrum", saved({ strengths, resumeSections: { ...allSections, strengths: false } })).met)
      .toEqual([]);
  });

  it("Kenntnisse: the visible items of the visible knowledge groups, with their descriptions", () => {
    const resumeKnowledgeGroups = [{ id: "g1", title: "Werkzeuge", semanticType: "tools", order: 0, items: [
      { id: "i1", text: "Terraform", description: "Infrastruktur für Kubernetes", order: 0 },
      { id: "i2", text: "Ansible", order: 1, visible: false },
    ] }];
    const result = preview("Terraform, Kubernetes, Ansible", saved({ resumeKnowledgeGroups }));
    expect(found(result)).toEqual({ Kubernetes: "Lebenslauf · Kenntnisse: Werkzeuge", Terraform: "Kenntnisse · Terraform" });
    expect(preview("Terraform, Kubernetes", saved({ resumeKnowledgeGroups,
      resumeManagerOverrides: { "group:g1": { visible: false } } })).met).toEqual([]);
  });

  it("Bildungsweg: the printed details of an entry, without a switched-off description", () => {
    const education = [{ id: uuid(4), from: "2018", to: "2021", degree: "Bachelor of Science", institution: "Universität Kassel",
      fieldOfStudy: "Informatik", status: "Abgeschlossen", description: "Abschlussarbeit über Kubernetes-Cluster" }];
    expect(found(preview("Kubernetes", saved({ education })))).toEqual({ Kubernetes: "Lebenslauf · Bildungsweg: Bachelor of Science" });
    expect(missing(preview("Kubernetes", saved({ education, resumeEducationFieldVisibility: { description: false } }))))
      .toEqual(["Kubernetes"]);
  });

  it("Sprachen: only a printed language section proves a language", () => {
    expect(preview("Gute Englischkenntnisse", saved({ languages: ["Englisch – C1"] })).score).toBe(100);
    expect(preview("Gute Englischkenntnisse", saved({ languages: ["Englisch – C1"],
      resumeSections: { ...allSections, languages: false } })).score).toBe(0);
  });

  it("Zertifikate: only the certificates chosen for this Bewerbung", () => {
    const certificates = saved({
      certifications: ["2024 · Certified Kubernetes Application Developer · CNCF", "2023 · Professional Scrum Master · Scrum.org"],
      certificationIds: ["c1", "c2"],
    });
    expect(preview("Kubernetes, Scrum", certificates).score).toBe(100);
    const chosen = preview("Kubernetes, Scrum", certificates, { presentation: { selectedCertificateIds: ["c1"] } });
    expect(found(chosen)).toEqual({ Kubernetes: "Lebenslauf · Zertifikat: 2024 · Certified Kubernetes Application Developer · CNCF" });
    expect(missing(chosen)).toEqual(["Scrum"]);
  });

  it("Projekte: the chosen projects as printed (title, technologies, description)", () => {
    const projects = saved({ specialSections: [{ id: uuid(5), kind: "projects", title: "Projekte", entries: [
      { id: uuid(6), title: "Lagerverwaltung", description: "Microservices mit Docker" },
      { id: uuid(7), title: "Monitoring", technologies: ["Kubernetes", "Grafana"] },
    ] }] });
    expect(found(preview("Docker, Kubernetes, Grafana", projects))).toEqual({
      Docker: "Lebenslauf · Projekt: Lagerverwaltung",
      Kubernetes: "Lebenslauf · Projekt: Monitoring",
      Grafana: "Lebenslauf · Projekt: Monitoring",
    });
    const chosen = preview("Docker, Kubernetes", projects, { presentation: { selectedProjectEntryIds: [uuid(6)] } });
    expect(found(chosen)).toEqual({ Docker: "Lebenslauf · Projekt: Lagerverwaltung" });
    expect(missing(chosen)).toEqual(["Kubernetes"]);
  });

  it("Hobbys und weitere Bereiche: every visible special section, not a hidden one", () => {
    const interests = (isVisible: boolean) => saved({ specialSections: [{ id: uuid(8), kind: "interests", title: "Hobbys & Interessen",
      isVisible, entries: [{ id: uuid(9), title: "Homelab", description: "Eigener Kubernetes-Cluster" }] }] });
    expect(found(preview("Kubernetes", interests(true)))).toEqual({ Kubernetes: "Lebenslauf · Hobbys & Interessen: Homelab" });
    expect(missing(preview("Kubernetes", interests(false)))).toEqual(["Kubernetes"]);
  });
});
