import { act } from "react";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDocumentDesign } from "../../shared/documentDesign";
import type { InterviewNoteFile, InterviewNotesListing } from "../../shared/ipc";
import { serializeInterviewQuestions, parseInterviewQuestions } from "../../shared/interviewQuestions";
import { applicationSchema, type Application } from "../../shared/schema";
import { InterviewPreparationPanel } from "./InterviewPreparationPanel";

const reportSavedChange = vi.hoisted(() => vi.fn());
vi.mock("../../store/useAppStore", () => ({
  useAppStore: (selector: (state: { reportSavedChange: typeof reportSavedChange }) => unknown) =>
    selector({ reportSavedChange }),
}));

const now = "2026-10-01T10:00:00.000Z";
const makeApplication = (id: string, company: string, title: string): Application => applicationSchema.parse({
  schemaVersion: 1,
  id,
  folderName: `${company}_2026-10-01/${title}`,
  company: { name: company, city: "Berlin" },
  contact: {},
  job: { title },
  status: "Vorstellungsgespräch",
  interviewAt: new Date(2026, 9, 22, 10, 30).toISOString(),
  templateId: "classic-professional",
  accentColor: "#155e58",
  secondaryColor: "#244766",
  designSettings: defaultDocumentDesign,
  documents: {},
  attachmentIds: [],
  statusHistory: [{ at: now, to: "Vorstellungsgespräch" }],
  createdAt: now,
  updatedAt: now,
});

const questionText = (prefix: string, count: number) => Array.from({ length: count }, (_, index) =>
  `Frage ${index + 1}: ${prefix} ${index + 1}?\nErklärung:\nWarum ${index + 1}\nAntwort:\nAntwort ${index + 1}\n- Liste ${index + 1}\n`,
).join("\n");

const noteFile = (fileName: string, content: string | null, error: string | null = null): InterviewNoteFile => ({
  fileName, revision: "a".repeat(64), modifiedAt: now, content, error,
});

describe("InterviewPreparationPanel", () => {
  let window: ReturnType<typeof parseHTML>["window"];
  let previous: Record<string, unknown>;
  let api: { list: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let root: { render: (node: React.ReactNode) => void; unmount: () => void };

  beforeEach(async () => {
    previous = { window: globalThis.window, document: globalThis.document };
    ({ window } = parseHTML("<html><body><div id='root'></div></body></html>"));
    api = { list: vi.fn(), create: vi.fn(), update: vi.fn() };
    Object.assign(window, { bewerbungsManager: { interviews: api }, confirm: () => true });
    // linkedom lacks two browser details React relies on: `oninput` (else React never reports textarea input) and
    // `defaultValue` (the initial value of a controlled textarea).
    Object.assign(window.document, { oninput: null });
    Object.defineProperty(Object.getPrototypeOf(window.document.createElement("textarea")), "defaultValue", {
      configurable: true,
      get(this: HTMLTextAreaElement) { return this.textContent; },
      set(this: HTMLTextAreaElement, value: string) { this.textContent = value; },
    });
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    root = createRoot(window.document.getElementById("root")!);
    reportSavedChange.mockReset();
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    Object.assign(globalThis, previous);
  });

  const render = async (application: Application) => {
    await act(async () => { root.render(<InterviewPreparationPanel application={application} onClose={vi.fn()} />); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  };
  const doc = () => window.document;
  const buttonWith = (text: string) =>
    Array.from(doc().querySelectorAll("button")).find((button) => button.textContent?.includes(text)) as HTMLButtonElement;
  const questionButtons = () => Array.from(doc().querySelectorAll<HTMLButtonElement>(".interview-answer__toggle"));
  const questionTitles = () => Array.from(doc().querySelectorAll(".interview-question__heading")).map((title) => title.textContent);
  const explanations = () => Array.from(doc().querySelectorAll<HTMLElement>(".interview-question__explanation"));
  const panels = () => Array.from(doc().querySelectorAll<HTMLElement>(".interview-answer__body"));
  const click = async (element: HTMLElement) => { await act(async () => { element.click(); }); };

  it("shows company, position and date; questions and Erklärungen visible, every Antwort closed and opened independently", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000001", "Seidel GmbH & Co. KG", "Entwickler");
    api.list.mockResolvedValue({
      applicationId: application.id,
      folderName: "Seidel_GmbH_&_Co._KG_2026-10-22",
      sharedWith: [],
      files: [
        noteFile("Vorstellungsgespräch.md", serializeInterviewQuestions(parseInterviewQuestions(questionText("Erste", 3)).questions)),
        noteFile("Vorstellungsgespräch_1.md", serializeInterviewQuestions(parseInterviewQuestions(questionText("Zweite", 2)).questions)),
      ],
    } satisfies InterviewNotesListing);
    await render(application);

    expect(api.list).toHaveBeenCalledWith(application.id);
    const header = doc().querySelector(".interview-prep__header")!.textContent!;
    expect(header).toContain("Seidel GmbH & Co. KG");
    expect(header).toContain("Entwickler");
    expect(header).toContain("22.10.2026");
    expect(doc().querySelector('[role="dialog"]')!.getAttribute("aria-modal")).toBe("true");

    expect(questionTitles()).toEqual(["Frage 1Erste 1?", "Frage 2Erste 2?", "Frage 3Erste 3?"]);
    expect(doc().querySelector(".interview-question__badge")!.textContent).toBe("1");
    // The Erklärung is always shown; only the Antwort is closed.
    expect(explanations().map((section) => section.textContent)).toEqual(["ErklärungWarum 1", "ErklärungWarum 2", "ErklärungWarum 3"]);
    expect(questionButtons().every((button) => button.getAttribute("aria-expanded") === "false" && button.type === "button")).toBe(true);
    expect(panels().every((panel) => panel.hasAttribute("hidden"))).toBe(true);
    expect(questionButtons()[0].getAttribute("aria-controls")).toBe(panels()[0].id);
    expect(questionButtons()[0].textContent).toBe("AntwortAnzeigen");

    await click(questionButtons()[0]);
    expect(questionButtons().map((button) => button.getAttribute("aria-expanded"))).toEqual(["true", "false", "false"]);
    expect(questionButtons()[0].textContent).toBe("AntwortAusblenden");
    expect(panels()[0].hasAttribute("hidden")).toBe(false);
    expect(panels()[0].querySelector("p")!.textContent).toBe("Antwort 1");
    expect(Array.from(panels()[0].querySelectorAll("ul > li")).map((item) => item.textContent)).toEqual(["Liste 1"]);

    await click(questionButtons()[2]);
    expect(questionButtons().map((button) => button.getAttribute("aria-expanded"))).toEqual(["true", "false", "true"]);
    await click(questionButtons()[0]);
    expect(questionButtons().map((button) => button.getAttribute("aria-expanded"))).toEqual(["false", "false", "true"]);

    // Another file starts with all answers closed.
    await click(buttonWith("Vorstellungsgespräch_1.md"));
    expect(buttonWith("Vorstellungsgespräch_1.md").getAttribute("aria-pressed")).toBe("true");
    expect(questionTitles()).toEqual(["Frage 1Zweite 1?", "Frage 2Zweite 2?"]);
    expect(questionButtons().every((button) => button.getAttribute("aria-expanded") === "false")).toBe(true);
  });

  it("jumps from the Fragenindex to a question and opens its Antwort", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000014", "Index GmbH", "Entwickler");
    api.list.mockResolvedValue({
      applicationId: application.id, folderName: "Index_GmbH_2026-10-22", sharedWith: [],
      files: [noteFile("Vorstellungsgespräch_Index.md", questionText("Index", 14))],
    });
    await render(application);
    const index = doc().querySelector('nav[aria-label="Fragenindex"]')!;
    const chips = Array.from(index.querySelectorAll<HTMLButtonElement>("button"));
    expect(chips.map((chip) => chip.textContent)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"]);
    expect(chips[12].getAttribute("title")).toBe("Frage 13: Index 13?");
    // linkedom tracks neither focus nor layout: record the calls instead.
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    Object.assign(questionButtons()[12], { focus });
    Object.assign(doc().querySelectorAll(".interview-question")[12], { scrollIntoView });
    await click(chips[12]);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(questionButtons().map((button, at) => [at, button.getAttribute("aria-expanded")]).filter(([, value]) => value === "true"))
      .toEqual([[12, "true"]]);
    expect(panels()[12].hasAttribute("hidden")).toBe(false);
    expect(chips[12].className).toContain("open");
    // A second jump keeps the first answer open.
    await click(chips[1]);
    expect(questionButtons().filter((button) => button.getAttribute("aria-expanded") === "true")).toHaveLength(2);
  });

  it("searches the shown file: marks hits, keeps only questions with hits and opens answers that contain them", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000016", "Such GmbH", "Entwickler");
    const markdown = [
      "# Vorbereitung", "", "Einleitung über die Firma.", "",
      "## Frage 1: Was wissen Sie über uns?", "### Erklärung", "Interesse prüfen.", "### Antwort", "Ich kenne Ihre **Maschinen**.",
      "", "## Frage 2: Ihre Stärken?", "### Erklärung", "Konkrete Beispiele.", "### Antwort", "Teamarbeit.",
      "", "## Frage 3: Warum Maschinen?", "### Erklärung", "Motivation.", "### Antwort", "Technik.",
    ].join("\n");
    api.list.mockResolvedValue({
      applicationId: application.id, folderName: "Such_GmbH_2026-10-22", sharedWith: [],
      files: [noteFile("Vorstellungsgespräch_Such.md", markdown)],
    });
    await render(application);
    const input = doc().querySelector<HTMLInputElement>('input[aria-label="In dieser Datei suchen"]')!;
    const type = async (value: string) => act(async () => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set?.call(input, value);
      if (input.value !== value) input.value = value;
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await type("maschinen");
    expect(doc().querySelector(".interview-search__summary")!.textContent).toBe("2 Treffer in 2 Fragen");
    expect(questionTitles()).toEqual(["Frage 1Was wissen Sie über uns?", "Frage 3Warum Maschinen?"]);
    expect(Array.from(doc().querySelectorAll("mark")).map((mark) => mark.textContent)).toEqual(["Maschinen", "Maschinen"]);
    // The hit in Frage 1's Antwort opens it; Frage 3 only has its hit in the question.
    expect(questionButtons().map((button) => button.getAttribute("aria-expanded"))).toEqual(["true", "false"]);
    expect(doc().querySelector('[aria-label="Einleitung"]')).toBeNull();
    expect(Array.from(doc().querySelectorAll('nav[aria-label="Fragenindex"] button')).map((chip) => chip.textContent)).toEqual(["1", "3"]);

    await type("Firma");
    expect(doc().querySelector(".interview-search__summary")!.textContent).toBe("1 Treffer in der Einleitung");
    expect(doc().querySelector('[aria-label="Einleitung"] mark')!.textContent).toBe("Firma");

    await type("gibt es nicht");
    expect(doc().querySelector(".interview-search__summary")!.textContent).toBe("Keine Treffer für „gibt es nicht“");
    expect(questionTitles()).toEqual([]);

    await click(doc().querySelector<HTMLButtonElement>('button[aria-label="Suche löschen"]')!);
    expect(questionTitles()).toHaveLength(3);
    expect(doc().querySelector("mark")).toBeNull();
  });

  it("shows images as a gallery: downloaded ones through the main process, remote ones only named", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000017", "Bild GmbH", "Entwickler");
    const remote = "https://images.openai.com/static-rsc-4/hairnet?purpose=inline";
    const markdown = [
      "## Frage 1: Welche Schutzkleidung?", "### Antwort", "Typische Schutzkleidung in der Pharmaproduktion", "",
      '![Kittel Foto](Bilder/Kittel_0123456789.png "Quelle: https://images.openai.com/x")', "", "Schutzkittel", "",
      `[Haarnetz Foto](${remote})`, "", "Haarnetz",
    ].join("\n");
    const file = noteFile("Vorstellungsgespräch_Bild.md", markdown);
    api.list.mockResolvedValue({ applicationId: application.id, folderName: "Bild_GmbH_2026-10-22", sharedWith: [], files: [file] });
    const image = vi.fn().mockResolvedValue("data:image/png;base64,iVBORw0KGgo=");
    const update = vi.fn().mockResolvedValue({
      file, changed: true, images: { saved: 1, failed: ["Defekt"] }, gitSync: { state: "skipped" },
    });
    Object.assign(api, { image, update });
    await render(application);
    await click(questionButtons()[0]);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    const gallery = panels()[0].querySelector('[aria-label="Bilder"]')!;
    expect(gallery.querySelector(".interview-gallery__title")!.textContent).toBe("Typische Schutzkleidung in der Pharmaproduktion");
    expect(Array.from(gallery.querySelectorAll("figcaption")).map((caption) => caption.textContent)).toEqual(["Schutzkittel", "Haarnetz"]);
    expect(image).toHaveBeenCalledWith(application.id, "Bilder/Kittel_0123456789.png");
    const images = Array.from(gallery.querySelectorAll("img"));
    expect(images.map((element) => [element.getAttribute("src"), element.getAttribute("alt")]))
      .toEqual([["data:image/png;base64,iVBORw0KGgo=", "Kittel Foto"]]);
    // The remote image is never loaded: only named, with a link for the browser.
    const placeholder = gallery.querySelector('[role="img"][aria-label="Haarnetz Foto"]')!;
    expect(placeholder.textContent).toContain("Noch nicht heruntergeladen");
    // The download is offered in the gallery itself, too.
    expect(placeholder.querySelector("button")!.textContent).toBe(" Bilder herunterladen");
    expect(Array.from(doc().querySelectorAll("img")).some((element) => element.getAttribute("src")?.startsWith("https:"))).toBe(false);

    await click(buttonWith("Bild herunterladen"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(update).toHaveBeenCalledWith(application.id, "Vorstellungsgespräch_Bild.md", markdown, file.revision);
    expect(doc().querySelector(".interview-prep__notice")!.textContent).toBe("1 Bild wurde im Ordner „Bilder“ gespeichert.");
    expect(doc().querySelector('[role="alert"]')!.textContent)
      .toBe("1 Bild konnte nicht heruntergeladen werden (Defekt). Die Links bleiben erhalten.");
  });

  it("offers up and down buttons that scroll the panel", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000015", "Scroll GmbH", "Entwickler");
    api.list.mockResolvedValue({
      applicationId: application.id, folderName: "Scroll_GmbH_2026-10-22", sharedWith: [],
      files: [noteFile("Vorstellungsgespräch_Scroll.md", questionText("Scroll", 3))],
    });
    await render(application);
    const panel = doc().querySelector<HTMLElement>(".interview-prep")!;
    // linkedom has no layout: give the panel a scroll height and a scroll position.
    Object.defineProperties(panel, {
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    const scrollTo = vi.fn();
    Object.assign(panel, { scrollTo });
    await act(async () => { panel.dispatchEvent(new window.Event("scroll")); });
    const up = doc().querySelector<HTMLButtonElement>('button[aria-label="Nach oben"]')!;
    const down = doc().querySelector<HTMLButtonElement>('button[aria-label="Nach unten"]')!;
    expect([up.disabled, down.disabled]).toEqual([true, false]);
    await click(down);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 2000, behavior: "smooth" });
    panel.scrollTop = 1500;
    await act(async () => { panel.dispatchEvent(new window.Event("scroll")); });
    expect([up.disabled, down.disabled]).toEqual([false, true]);
    await click(up);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "smooth" });
  });

  it("renders user text as text, never as HTML", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000002", "Sicher GmbH", "Tester");
    api.list.mockResolvedValue({
      applicationId: application.id, folderName: "Sicher_GmbH_2026-10-22", sharedWith: [],
      files: [noteFile("Vorstellungsgespräch.md", "Frage 1: <img src=x onerror=alert(1)>?\nAntwort:\n<script>alert(2)</script>")],
    });
    await render(application);
    await click(questionButtons()[0]);
    expect(doc().querySelector("img")).toBeNull();
    expect(doc().querySelector("script")).toBeNull();
    expect(panels()[0].textContent).toContain("<script>alert(2)</script>");
    expect(questionTitles()[0]).toContain("<img src=x onerror=alert(1)>");
  });

  it("formats Markdown: headings, emphasis, quotes, code, tables and safe links", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000010", "Format GmbH", "Tester");
    const markdown = [
      "Frage 1: Welche Stärken?",
      "Erklärung:",
      "#### Worauf es ankommt",
      "Der Interviewer prüft **Selbstreflexion** und *Beispiele*.",
      "",
      "> Wichtig: ehrlich bleiben",
      "Antwort:",
      "| Stärke | Beispiel |",
      "|---|---|",
      "| Analyse | `SQL` |",
      "",
      "Mehr unter [Firma](https://example.com) oder [Trick](javascript:alert(1)).",
      "",
      "```",
      "<b>kein HTML</b>",
      "```",
    ].join("\n");
    api.list.mockResolvedValue({
      applicationId: application.id, folderName: "Format_GmbH_2026-10-22", sharedWith: [],
      files: [noteFile("Vorstellungsgespräch.md", markdown)],
    });
    const openExternal = vi.fn();
    Object.assign((window as unknown as { bewerbungsManager: Record<string, unknown> }).bewerbungsManager, { system: { openExternal } });
    await render(application);
    const explanation = explanations()[0];
    expect(explanation.querySelector('[role="heading"]')!.className).toBe("interview-md__h4");
    expect(explanation.querySelector("strong")!.textContent).toBe("Selbstreflexion");
    expect(explanation.querySelector("em")!.textContent).toBe("Beispiele");
    expect(explanation.querySelector("blockquote")!.textContent).toBe("Wichtig: ehrlich bleiben");

    await click(questionButtons()[0]);
    const answer = panels()[0];
    expect(Array.from(answer.querySelectorAll("th")).map((cell) => cell.textContent)).toEqual(["Stärke", "Beispiel"]);
    expect(answer.querySelector("td code")!.textContent).toBe("SQL");
    expect(answer.querySelector(".interview-md__table-wrap")!.getAttribute("tabindex")).toBe("0");
    expect(answer.querySelector("pre code")!.textContent).toBe("<b>kein HTML</b>");
    expect(answer.querySelector("b")).toBeNull();
    const links = Array.from(answer.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["https://example.com/"]);
    expect(answer.textContent).toContain("Trick (javascript:alert(1))");
    await click(links[0]);
    expect(openExternal).toHaveBeenCalledWith("https://example.com/");
  });

  it("parses pasted text, requires the preview and saves it as a new Markdown file", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000003", "Neu GmbH", "Entwickler");
    const pasted = questionText("Frage", 10);
    api.list.mockResolvedValueOnce({ applicationId: application.id, folderName: "Neu_GmbH_2026-10-22", sharedWith: [], files: [] });
    const saved = noteFile("Vorstellungsgespräch_Neu.md", serializeInterviewQuestions(parseInterviewQuestions(pasted).questions));
    api.create.mockResolvedValue({ file: saved, changed: true, gitSync: { state: "pending", syncId: 4 } });
    api.list.mockResolvedValueOnce({ applicationId: application.id, folderName: "Neu_GmbH_2026-10-22", sharedWith: [], files: [saved] });
    await render(application);

    expect(doc().body.textContent).toContain("Fragen & Antworten einfügen");
    expect(doc().body.textContent).toContain("„Vorstellungsgespräch_Neu.md“");
    const textarea = doc().querySelector<HTMLTextAreaElement>(".interview-editor__input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea), "value")?.set;
      if (setter) setter.call(textarea, pasted); else textarea.value = pasted;
      textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    expect(buttonWith("Als Markdown speichern").disabled).toBe(true);
    await click(buttonWith("Vorschau prüfen"));
    expect(doc().querySelector(".interview-editor__summary")!.textContent).toBe("10 Fragen erkannt.");
    expect(questionButtons()).toHaveLength(10);
    expect(panels().every((panel) => panel.hasAttribute("hidden"))).toBe(true);

    await click(buttonWith("Als Markdown speichern"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(api.create).toHaveBeenCalledWith(application.id, pasted);
    expect(reportSavedChange).toHaveBeenCalledWith(
      "„Vorstellungsgespräch_Neu.md“ wurde gespeichert.",
      "„Vorstellungsgespräch_Neu.md“ wurde gespeichert und mit GitHub synchronisiert.",
      { state: "pending", syncId: 4 },
    );
    expect(doc().querySelector('[role="status"]')!.textContent).toBe("„Vorstellungsgespräch_Neu.md“ wurde lokal gespeichert.");
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(questionButtons()).toHaveLength(10);
  });

  it("shows faulty input and save errors in German and keeps the text", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000004", "Fehler GmbH", "Entwickler");
    api.list.mockResolvedValue({ applicationId: application.id, folderName: "Fehler_GmbH_2026-10-22", sharedWith: [], files: [] });
    api.create.mockRejectedValue(new Error("„Vorstellungsgespräch.md“ konnte nicht gespeichert werden. Vorhandene Inhalte bleiben unverändert."));
    await render(application);
    const textarea = doc().querySelector<HTMLTextAreaElement>(".interview-editor__input")!;
    const type = async (value: string) => act(async () => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(textarea), "value")?.set;
      if (setter) setter.call(textarea, value); else textarea.value = value;
      textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await type("Frage 1:\nAntwort: a");
    await click(buttonWith("Vorschau prüfen"));
    expect(doc().querySelector(".interview-issues")!.textContent).toContain("Frage 1: Der Fragetext fehlt.");
    expect(buttonWith("Als Markdown speichern").disabled).toBe(true);

    await type("Frage 1: A?\nErklärung: e\nAntwort: a");
    expect(doc().body.textContent).toContain("Der Text wurde nach der Vorschau geändert.");
    await click(buttonWith("Vorschau prüfen"));
    await click(buttonWith("Als Markdown speichern"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(doc().querySelector('[role="alert"]')!.textContent).toContain("konnte nicht gespeichert werden");
    expect(textarea.value).toBe("Frage 1: A?\nErklärung: e\nAntwort: a");
    expect(reportSavedChange).not.toHaveBeenCalled();
  });

  it("updates an opened file in place with its revision", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000005", "Edit GmbH", "Entwickler");
    const content = serializeInterviewQuestions(parseInterviewQuestions(questionText("Alt", 1)).questions);
    const file = { ...noteFile("Vorstellungsgespräch_1.md", content), revision: "b".repeat(64) };
    api.list.mockResolvedValue({ applicationId: application.id, folderName: "Edit_GmbH_2026-10-22", sharedWith: [], files: [file] });
    api.update.mockResolvedValue({ file, changed: false, gitSync: { state: "skipped" } });
    await render(application);
    await click(buttonWith("Datei bearbeiten"));
    expect(doc().querySelector<HTMLTextAreaElement>(".interview-editor__input")!.value).toBe(content);
    await click(buttonWith("Vorschau prüfen"));
    await click(buttonWith("Als Markdown speichern"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(api.update).toHaveBeenCalledWith(application.id, "Vorstellungsgespräch_1.md", content, "b".repeat(64));
    expect(api.create).not.toHaveBeenCalled();
    expect(doc().body.textContent).toContain("Keine Änderungen – „Vorstellungsgespräch_1.md“ bleibt unverändert.");
  });

  it("deletes the shown file after a confirmation and shows the next one", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000011", "Lösch GmbH", "Entwickler");
    const first = { ...noteFile("Vorstellungsgespräch.md", "Frage 1: Erste?\nAntwort: a"), revision: "c".repeat(64) };
    const second = noteFile("Vorstellungsgespräch_1.md", "Frage 1: Zweite?\nAntwort: b");
    api.list.mockResolvedValueOnce({ applicationId: application.id, folderName: "Lösch_GmbH_2026-10-22", sharedWith: [], files: [first, second] });
    api.list.mockResolvedValueOnce({ applicationId: application.id, folderName: "Lösch_GmbH_2026-10-22", sharedWith: [], files: [second] });
    const remove = vi.fn().mockResolvedValue({
      fileName: first.fileName,
      archivedAs: "Vorstellungsgespräch\\Lösch_GmbH_2026-10-22\\Vorstellungsgespräch_gelöscht_2026-10-21_20-00-00.md",
      gitSync: { state: "pending", syncId: 9 },
    });
    Object.assign(api, { remove });
    await render(application);

    let asked = "";
    Object.assign(window, { confirm: (message: string) => { asked = message; return false; } });
    await click(buttonWith("Datei löschen"));
    expect(asked).toContain("„Vorstellungsgespräch.md“ wirklich löschen?");
    expect(remove).not.toHaveBeenCalled();

    Object.assign(window, { confirm: () => true });
    await click(buttonWith("Datei löschen"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(remove).toHaveBeenCalledWith(application.id, "Vorstellungsgespräch.md", "c".repeat(64));
    expect(reportSavedChange).toHaveBeenCalledWith(
      "„Vorstellungsgespräch.md“ wurde gelöscht.",
      "„Vorstellungsgespräch.md“ wurde gelöscht und mit GitHub synchronisiert.",
      { state: "pending", syncId: 9 },
    );
    expect(doc().querySelector('[role="status"]')!.textContent).toBe(
      "„Vorstellungsgespräch.md“ wurde gelöscht und unter „Vorstellungsgespräch/Lösch_GmbH_2026-10-22/Vorstellungsgespräch_gelöscht_2026-10-21_20-00-00.md“ aufbewahrt.",
    );
    expect(buttonWith("Vorstellungsgespräch_1.md").getAttribute("aria-pressed")).toBe("true");
    expect(questionTitles()).toEqual(["Frage 1Zweite?"]);
  });

  it("opens the shown Markdown file in another program and reports a failure", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000013", "Öffnen GmbH", "Entwickler");
    const file = noteFile("Vorstellungsgespräch_Öffnen.md", "Frage 1: Offen?\nAntwort: ja");
    api.list.mockResolvedValue({ applicationId: application.id, folderName: "Offnen_GmbH_2026-10-22", sharedWith: [], files: [file] });
    const open = vi.fn().mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Die Markdown-Datei konnte nicht geöffnet werden."));
    Object.assign(api, { open });
    await render(application);
    await click(buttonWith("Datei öffnen"));
    expect(open).toHaveBeenCalledWith(application.id, "Vorstellungsgespräch_Öffnen.md");
    expect(doc().querySelector('[role="alert"]')).toBeNull();
    await click(buttonWith("Datei öffnen"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(doc().querySelector('[role="alert"]')!.textContent).toBe("Die Markdown-Datei konnte nicht geöffnet werden.");
    // Coming back to the app reads the files again (they may have been changed in the other program).
    const calls = api.list.mock.calls.length;
    await act(async () => { window.dispatchEvent(new window.Event("focus")); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(api.list.mock.calls.length).toBe(calls + 1);
  });

  it("shows the intro, document text and hides a missing Erklärung", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000012", "Dokument GmbH", "Entwickler");
    api.list.mockResolvedValue({
      applicationId: application.id, folderName: "Dokument_GmbH_2026-10-22", sharedWith: [],
      files: [noteFile("Vorstellungsgespräch.md", [
        "# Vorstellungsgespräch – Dokument GmbH", "", "Meine **Einschätzung** vorab.", "",
        "## 8. Fragen", "### Frage 1: Warum wir?", "> „Darum.“", "", "## 9. Stressfragen", "Ruhig bleiben.",
      ].join("\n"))],
    });
    await render(application);
    const intro = doc().querySelector('[aria-label="Einleitung"]')!;
    expect(intro.querySelector(".interview-doc__title")!.textContent).toBe("Vorstellungsgespräch – Dokument GmbH");
    expect(intro.querySelector("strong")!.textContent).toBe("Einschätzung");
    expect(explanations()).toHaveLength(0);
    expect(doc().querySelector('[aria-label="Weiterer Text"]')!.textContent).toContain("Ruhig bleiben.");
    expect(doc().querySelector(".interview-issues")).toBeNull();
    expect(doc().body.textContent).not.toContain("nicht vollständig interpretiert");
  });

  it("names a damaged file and a folder shared with another Bewerbung", async () => {
    const application = makeApplication("10000000-0000-4000-8000-000000000006", "Kaputt GmbH", "Entwickler");
    api.list.mockResolvedValue({
      applicationId: application.id, folderName: "Kaputt_GmbH_2026-10-22", sharedWith: [],
      files: [noteFile("Vorstellungsgespräch.md", null, "„Vorstellungsgespräch.md“ ist keine gültige UTF-8-Textdatei. Die Datei wird nicht überschrieben.")],
    });
    await render(application);
    expect(doc().querySelector('[role="alert"]')!.textContent).toContain("„Vorstellungsgespräch.md“ ist keine gültige UTF-8-Textdatei");
    expect(buttonWith("Datei bearbeiten")).toBeUndefined();

    const other = makeApplication("10000000-0000-4000-8000-000000000007", "Doppel GmbH", "Tester");
    api.list.mockResolvedValue({
      applicationId: other.id, folderName: "Doppel_GmbH_2026-10-22",
      sharedWith: [{ company: "Doppel GmbH", position: "Entwickler" }], files: [],
    });
    await render(other);
    expect(api.list).toHaveBeenLastCalledWith(other.id);
    expect(doc().querySelector('[role="alert"]')!.textContent).toContain("gehört nicht eindeutig zu dieser Bewerbung");
    expect(doc().body.textContent).toContain("Doppel GmbH – Entwickler");
    expect(buttonWith("Neue Datei")).toBeUndefined();
  });

  it("ignores a late answer for the previously shown Bewerbung", async () => {
    const first = makeApplication("10000000-0000-4000-8000-000000000008", "Erste GmbH", "A");
    const second = makeApplication("10000000-0000-4000-8000-000000000009", "Zweite GmbH", "B");
    let resolveFirst!: (listing: InterviewNotesListing) => void;
    api.list.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    api.list.mockResolvedValueOnce({
      applicationId: second.id, folderName: "Zweite_GmbH_2026-10-22", sharedWith: [],
      files: [noteFile("Vorstellungsgespräch.md", "Frage 1: Zweite?\nAntwort: ja")],
    });
    await render(first);
    await render(second);
    await act(async () => {
      resolveFirst({
        applicationId: first.id, folderName: "Erste_GmbH_2026-10-22", sharedWith: [],
        files: [noteFile("Vorstellungsgespräch.md", "Frage 1: Erste?\nAntwort: ja")],
      });
    });
    expect(questionTitles()).toEqual(["Frage 1Zweite?"]);
  });
});
