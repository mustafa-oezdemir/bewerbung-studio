import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Eye, FilePlus2, FileText, PencilLine, ImageDown, Save, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { InterviewNoteFile, InterviewNotesListing } from "../../shared/ipc";
import {
  hasBlockingIssues,
  interviewCompanySlug,
  interviewNoteLimits,
  nextInterviewNoteFileName,
  interviewNoteTitle,
  isTypingHint,
  parseInterviewQuestions,
  type InterviewParseResult,
  type InterviewQuestion,
} from "../../shared/interviewQuestions";
import type { Application } from "../../shared/schema";
import { formatDate } from "../../lib/format";
import { useAppStore } from "../../store/useAppStore";
import {
  countSearchHits,
  highlightText,
  InterviewImageDownload,
  InterviewImageLoader,
  InterviewMarkdown,
  interviewSearchPattern,
} from "./InterviewMarkdown";
import { parseMarkdownBlocks, remoteInterviewImages } from "../../shared/interviewMarkdown";

type ImageResult = { saved: number; failed: string[] } | undefined;

const savedImagesText = (images: ImageResult) => images?.saved
  ? ` ${images.saved} ${images.saved === 1 ? "Bild wurde" : "Bilder wurden"} im Ordner „Bilder“ gespeichert.`
  : "";

const failedImagesText = (images: ImageResult) => images?.failed.length
  ? `${images.failed.length} ${images.failed.length === 1 ? "Bild konnte" : "Bilder konnten"} nicht heruntergeladen werden ` +
    `(${images.failed.slice(0, 5).join("; ")}${images.failed.length > 5 ? " …" : ""}). Die Links bleiben erhalten.`
  : null;

const isOnlyHeadings = (markdown: string) =>
  parseMarkdownBlocks(markdown).every((block) => block.type === "heading" || block.type === "rule");

type EditorMode = { kind: "create" } | { kind: "edit"; file: InterviewNoteFile };

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const inputExample = `Frage 1: Was wissen Sie über unser Unternehmen?

Erklärung:
Was der Arbeitgeber mit der Frage prüft …

Antwort:
Meine vorbereitete Antwort …

Frage 2: …`;

/**
 * Vorstellungsgespräch – Fragen & Antworten of one Bewerbung: the Markdown files of its interview folder, one
 * accordion per file (answers closed), and the input that parses pasted text, previews it and saves it as Markdown.
 */
export function InterviewPreparationPanel({
  application,
  onClose,
}: {
  application: Application;
  onClose: () => void;
}) {
  const reportSavedChange = useAppStore((state) => state.reportSavedChange);
  const [listing, setListing] = useState<InterviewNotesListing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ text: string; result: InterviewParseResult } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const request = useRef(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLElement>(null);
  // Whether the panel is scrolled to its top / bottom: the up and down buttons are disabled there.
  const [scrollEnds, setScrollEnds] = useState({ top: true, bottom: true });
  const updateScrollEnds = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const next = {
      top: element.scrollTop <= 4,
      bottom: element.scrollTop + element.clientHeight >= element.scrollHeight - 4,
    };
    setScrollEnds((current) => (current.top === next.top && current.bottom === next.bottom ? current : next));
  }, []);
  // Loading a file or opening an answer changes the height without a scroll event.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let frame: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(frame);
      frame = setTimeout(updateScrollEnds, 16);
    };
    schedule();
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(schedule);
    observer?.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("resize", schedule);
    return () => {
      clearTimeout(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [updateScrollEnds]);
  const titleId = useId();

  /** Loads the files of this Bewerbung; an answer for an earlier Bewerbung or an older request is ignored. */
  const load = useCallback(async (preferredFile?: string) => {
    const current = ++request.current;
    setLoadError(null);
    try {
      const result = await window.bewerbungsManager.interviews.list(application.id);
      if (current !== request.current || result.applicationId !== application.id) return;
      setListing(result);
      setSelectedFileName((selected) => {
        const wanted = preferredFile ?? selected;
        return result.files.some((file) => file.fileName === wanted) ? wanted! : result.files[0]?.fileName ?? null;
      });
      if (!result.files.length && !result.sharedWith.length) setEditor({ kind: "create" });
    } catch (error) {
      if (current !== request.current) return;
      setListing(null);
      setLoadError(errorText(error, "Die Vorstellungsgespräch-Notizen konnten nicht geladen werden."));
    }
  }, [application.id]);

  useEffect(() => {
    setListing(null);
    setSelectedFileName(null);
    setEditor(null);
    setText("");
    setPreview(null);
    setSaveError(null);
    setSaveNotice(null);
    void load();
  }, [load]);

  useEffect(() => { closeButton.current?.focus(); }, []);

  const dirty = editor !== null && text !== (editor.kind === "edit" ? editor.file.content ?? "" : "");
  const requestClose = () => {
    if (dirty && !window.confirm("Der eingegebene Text ist noch nicht gespeichert. Ansicht trotzdem schließen?")) return;
    onClose();
  };

  const selectedFile = listing?.files.find((file) => file.fileName === selectedFileName) ?? null;
  // The same rule as the main process, which picks the final name.
  const nextFileName = useMemo(
    () => nextInterviewNoteFileName(
      interviewCompanySlug(application.company.name),
      (listing?.files ?? []).map((file) => file.fileName),
    ),
    [application.company.name, listing],
  );

  const openEditor = (mode: EditorMode) => {
    setEditor(mode);
    setText(mode.kind === "edit" ? mode.file.content ?? "" : "");
    setPreview(null);
    setSaveError(null);
    setSaveNotice(null);
  };

  const closeEditor = () => {
    if (dirty && !window.confirm("Der eingegebene Text ist noch nicht gespeichert. Eingabe verwerfen?")) return;
    setEditor(null);
    setText("");
    setPreview(null);
    setSaveError(null);
  };

  const previewIsCurrent = preview !== null && preview.text === text;
  const canSave = previewIsCurrent && !hasBlockingIssues(preview.result) && !saving;

  const save = async () => {
    if (!editor || !canSave) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const result = editor.kind === "edit"
        ? await window.bewerbungsManager.interviews.update(application.id, editor.file.fileName, text, editor.file.revision)
        : await window.bewerbungsManager.interviews.create(application.id, text);
      const name = result.file.fileName;
      if (result.changed) {
        reportSavedChange(
          `„${name}“ wurde gespeichert.`,
          `„${name}“ wurde gespeichert und mit GitHub synchronisiert.`,
          result.gitSync,
        );
      }
      setSaveNotice((result.changed
        ? `„${name}“ wurde lokal gespeichert.`
        : `Keine Änderungen – „${name}“ bleibt unverändert.`) + savedImagesText(result.images));
      setSaveError(failedImagesText(result.images));
      setEditor(null);
      setText("");
      setPreview(null);
      await load(name);
    } catch (error) {
      setSaveError(errorText(error, "Die Fragen konnten nicht gespeichert werden. Der eingegebene Text bleibt erhalten."));
    } finally {
      setSaving(false);
    }
  };

  /** Opens the shown file in another program; the list is read again when the app gets the focus back. */
  /** Downloads the images a saved file still links to (a file from before, or one edited outside the app). */
  const downloadImages = async (file: InterviewNoteFile) => {
    if (saving || file.content === null) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const result = await window.bewerbungsManager.interviews.update(application.id, file.fileName, file.content, file.revision);
      const name = result.file.fileName;
      if (result.changed) {
        reportSavedChange(
          `Bilder in „${name}“ wurden gespeichert.`,
          `Bilder in „${name}“ wurden gespeichert und mit GitHub synchronisiert.`,
          result.gitSync,
        );
      }
      setSaveNotice(result.images?.saved
        ? savedImagesText(result.images).trim()
        : "Es wurde kein Bild heruntergeladen.");
      setSaveError(failedImagesText(result.images));
      await load(name);
    } catch (error) {
      setSaveError(errorText(error, "Die Bilder konnten nicht heruntergeladen werden."));
    } finally {
      setSaving(false);
    }
  };

  // Downloaded images are read once per panel (the main process checks every request).
  const loadImage = useMemo(() => {
    const cache = new Map<string, Promise<string>>();
    return (source: string) => {
      let image = cache.get(source);
      if (!image) {
        image = window.bewerbungsManager.interviews.image(application.id, source);
        cache.set(source, image);
        image.catch(() => cache.delete(source));
      }
      return image;
    };
  }, [application.id]);

  const openExternally = async (file: InterviewNoteFile) => {
    setSaveError(null);
    try {
      await window.bewerbungsManager.interviews.open(application.id, file.fileName);
    } catch (error) {
      setSaveError(errorText(error, `„${file.fileName}“ konnte nicht geöffnet werden.`));
    }
  };

  // A file changed in another program shows its new content (and revision) when the user comes back.
  useEffect(() => {
    const reloadOnFocus = () => {
      if (!editor && !saving) void load();
    };
    window.addEventListener("focus", reloadOnFocus);
    return () => window.removeEventListener("focus", reloadOnFocus);
  }, [editor, load, saving]);

  /** Deletes the shown file after a confirmation; the main process keeps it under „Silinenler“. */
  const remove = async (file: InterviewNoteFile) => {
    if (saving || !window.confirm(
      `„${file.fileName}“ wirklich löschen? Die Datei wird aus dem Vorstellungsgesprächsordner entfernt und unter ` +
      "„Silinenler/Vorstellungsgespräch“ aufbewahrt.",
    )) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const result = await window.bewerbungsManager.interviews.remove(application.id, file.fileName, file.revision);
      reportSavedChange(
        `„${result.fileName}“ wurde gelöscht.`,
        `„${result.fileName}“ wurde gelöscht und mit GitHub synchronisiert.`,
        result.gitSync,
      );
      setSaveNotice(`„${result.fileName}“ wurde gelöscht und unter „${result.archivedAs.replace(/\\/g, "/")}“ aufbewahrt.`);
      setSelectedFileName(null);
      await load();
    } catch (error) {
      setSaveError(errorText(error, `„${file.fileName}“ konnte nicht gelöscht werden.`));
    } finally {
      setSaving(false);
    }
  };

  const interviewDate = application.interviewAt ? formatDate(application.interviewAt, true) : "Termin offen";

  return (
    <InterviewImageLoader.Provider value={loadImage}>
    <div
      className="modal-backdrop"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          requestClose();
        }
      }}>
      <div className="interview-prep-frame">
      <section
        ref={scroller}
        className="interview-prep"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onScroll={updateScrollEnds}>
        <header className="interview-prep__header">
          <div>
            <p className="eyebrow">Vorstellungsgespräch – Fragen & Antworten</p>
            <h2 id={titleId}>{application.company.name || "Unternehmen offen"}</h2>
            <p className="interview-prep__meta">
              <span>{application.job.title || "Position offen"}</span>
              <span>Vorstellungsgespräch: {interviewDate}</span>
              {application.secondInterviewAt ? (
                <span>Zweites Gespräch: {formatDate(application.secondInterviewAt, true)}</span>
              ) : null}
            </p>
          </div>
          <button ref={closeButton} className="icon-button" type="button" aria-label="Schließen" onClick={requestClose}>
            <X size={19} />
          </button>
        </header>

        {loadError ? <p className="interview-prep__alert" role="alert">{loadError}</p> : null}
        {saveNotice ? <p className="interview-prep__notice" role="status">{saveNotice}</p> : null}

        {listing === null && !loadError ? <p className="interview-prep__muted">Notizen werden geladen …</p> : null}

        {listing && listing.sharedWith.length ? (
          <div className="interview-prep__alert" role="alert">
            <strong>Der Ordner „{listing.folderName}“ gehört nicht eindeutig zu dieser Bewerbung.</strong>
            <p>
              Für dasselbe Unternehmen und denselben Gesprächstag gibt es weitere Bewerbungen:{" "}
              {listing.sharedWith.map((other) => `${other.company} – ${other.position}`).join("; ")}. Damit keine Notizen
              einer falschen Bewerbung angezeigt oder überschrieben werden, werden hier keine Dateien gelesen oder
              gespeichert.
            </p>
          </div>
        ) : null}

        {listing && !listing.sharedWith.length ? (
          <>
            <div className="interview-prep__files">
              <div className="interview-prep__file-list" role="group" aria-label="Markdown-Dateien">
                {listing.files.map((file) => (
                  <button
                    key={file.fileName}
                    type="button"
                    className={`interview-file-chip${file.fileName === selectedFileName ? " active" : ""}`}
                    aria-pressed={file.fileName === selectedFileName}
                    disabled={editor !== null}
                    onClick={() => { setSelectedFileName(file.fileName); setSaveNotice(null); }}>
                    {file.error ? <AlertTriangle size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
                    <span>{file.fileName}</span>
                    {file.content !== null ? (
                      <small>{parseInterviewQuestions(file.content).questions.length} Fragen</small>
                    ) : null}
                  </button>
                ))}
                {!listing.files.length ? <span className="interview-prep__muted">Noch keine Datei gespeichert.</span> : null}
              </div>
              <button
                type="button"
                className="button secondary"
                disabled={editor !== null}
                onClick={() => openEditor({ kind: "create" })}>
                <FilePlus2 size={16} /> Neue Datei
              </button>
            </div>
            <p className="interview-prep__folder">Ordner: Vorstellungsgespräch/{listing.folderName}</p>

            {editor ? (
              <InterviewEditor
                mode={editor}
                text={text}
                onTextChange={setText}
                nextFileName={nextFileName}
                preview={preview}
                previewIsCurrent={previewIsCurrent}
                canSave={canSave}
                saving={saving}
                saveError={saveError}
                onPreview={() => setPreview({ text, result: parseInterviewQuestions(text) })}
                onSave={() => void save()}
                onCancel={closeEditor}
                cancellable={listing.files.length > 0}
              />
            ) : selectedFile ? (
              <>
                {saveError ? <p className="interview-prep__alert" role="alert">{saveError}</p> : null}
                <InterviewFileView
                  key={`${application.id}:${selectedFile.fileName}:${selectedFile.revision}`}
                  file={selectedFile}
                  busy={saving}
                  onEdit={() => openEditor({ kind: "edit", file: selectedFile })}
                  onDelete={() => void remove(selectedFile)}
                  onOpen={() => void openExternally(selectedFile)}
                  onDownloadImages={() => void downloadImages(selectedFile)}
                />
              </>
            ) : null}
          </>
        ) : null}
      </section>
      {scrollEnds.top && scrollEnds.bottom ? null : (
        <div className="interview-scroll" role="group" aria-label="Blättern">
          <button
            type="button"
            className="interview-scroll__button"
            aria-label="Nach oben"
            title="Nach oben"
            disabled={scrollEnds.top}
            onClick={() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}>
            <ChevronUp size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="interview-scroll__button"
            aria-label="Nach unten"
            title="Nach unten"
            disabled={scrollEnds.bottom}
            onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })}>
            <ChevronDown size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      </div>
    </div>
    </InterviewImageLoader.Provider>
  );
}

function InterviewFileView({
  file,
  onEdit,
  onDelete,
  onOpen,
  onDownloadImages,
  busy,
}: {
  file: InterviewNoteFile;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onDownloadImages: () => void;
  busy: boolean;
}) {
  const remoteImages = useMemo(() => (file.content === null ? 0 : remoteInterviewImages(file.content).length), [file.content]);
  const imageDownload = useMemo(
    () => (remoteImages ? { download: onDownloadImages, busy } : null),
    [busy, onDownloadImages, remoteImages],
  );
  const result = useMemo(() => (file.content === null ? null : parseInterviewQuestions(file.content)), [file.content]);
  const [query, setQuery] = useState("");
  const search = useMemo(() => interviewSearchPattern(query), [query]);
  const hits = useMemo(() => {
    if (!result || !search) return null;
    const questionHits = result.questions.map((question) =>
      countSearchHits(question.question, search) + countSearchHits(question.explanation, search) +
      countSearchHits(question.answer, search) + countSearchHits(question.following, search));
    return {
      total: questionHits.reduce((sum, count) => sum + count, 0) +
        countSearchHits(result.title, search) + countSearchHits(result.intro, search),
      questions: questionHits.filter(Boolean).length,
    };
  }, [result, search]);
  // A file without a revision (a symbolic link) is never deleted from here.
  const deleteButton = file.revision ? (
    <button type="button" className="button secondary interview-file__delete" onClick={onDelete} disabled={busy}>
      <Trash2 size={16} /> Datei löschen
    </button>
  ) : null;
  // Opens the .md file itself in the program Windows uses for Markdown (a symbolic link is never opened).
  const openButton = file.revision ? (
    <button
      type="button"
      className="button secondary"
      onClick={onOpen}
      disabled={busy}
      title="Öffnet die Markdown-Datei im Programm, das in Windows für .md-Dateien eingerichtet ist">
      <ExternalLink size={16} /> Datei öffnen
    </button>
  ) : null;
  if (file.error || !result) {
    return (
      <section className="interview-file" aria-label={file.fileName}>
        <p className="interview-prep__alert" role="alert">{file.error ?? `„${file.fileName}“ kann nicht gelesen werden.`}</p>
        {deleteButton ? <div className="interview-file__toolbar"><span className="interview-file__actions">{openButton}{deleteButton}</span></div> : null}
      </section>
    );
  }
  const blocking = hasBlockingIssues(result);
  return (
    <section className="interview-file" aria-label={file.fileName}>
      <div className="interview-file__toolbar">
        <span>
          <strong>{file.fileName}</strong> · {result.questions.length} {result.questions.length === 1 ? "Frage" : "Fragen"} ·
          zuletzt geändert {formatDate(file.modifiedAt, true)}
        </span>
        <span className="interview-file__actions">
          {remoteImages ? (
            <button
              type="button"
              className="button primary"
              onClick={onDownloadImages}
              disabled={busy}
              title="Lädt die verlinkten Bilder einmal herunter und speichert sie im Ordner „Bilder“ dieses Vorstellungsgesprächs">
              <ImageDown size={16} /> {remoteImages === 1 ? "Bild herunterladen" : `${remoteImages} Bilder herunterladen`}
            </button>
          ) : null}
          {openButton}
          <button type="button" className="button secondary" onClick={onEdit} disabled={busy}>
            <PencilLine size={16} /> Datei bearbeiten
          </button>
          {deleteButton}
        </span>
      </div>
      {blocking ? (
        <p className="interview-prep__alert" role="alert">
          „{file.fileName}“ kann nicht vollständig interpretiert werden und wird nicht automatisch überschrieben.
          Erkannte Fragen werden unten angezeigt; korrigieren Sie die Datei über „Datei bearbeiten“.
        </p>
      ) : null}
      {/* A saved file does not repeat the hints shown while typing (repeated labels, questions without Erklärung). */}
      <IssueList result={{ ...result, issues: result.issues.filter((issue) => !isTypingHint(issue)) }} />
      <div className="interview-search" role="search">
        <div className="interview-search__field">
        <Search className="interview-search__icon" size={17} aria-hidden="true" />
        <input
          type="search"
          className="interview-search__input"
          aria-label="In dieser Datei suchen"
          placeholder="In dieser Datei suchen – Wort oder Begriff …"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Escape clears the search first; only an empty search lets Escape close the panel.
            if (event.key === "Escape" && query) {
              event.stopPropagation();
              setQuery("");
            }
          }}
        />
        {query ? (
          <button type="button" className="interview-search__clear" aria-label="Suche löschen" onClick={() => setQuery("")}>
            <X size={15} aria-hidden="true" />
          </button>
        ) : null}
        </div>
        <span className="interview-search__summary" role="status" aria-live="polite">
          {hits
            ? hits.total
              ? hits.questions
                ? `${hits.total} Treffer in ${hits.questions} ${hits.questions === 1 ? "Frage" : "Fragen"}`
                : `${hits.total} Treffer in der Einleitung`
              : `Keine Treffer für „${query.trim()}“`
            : query.trim().length === 1 ? "Mindestens zwei Zeichen" : ""}
        </span>
      </div>
      {/* Images not yet downloaded offer the download right where they are shown. */}
      <InterviewImageDownload.Provider value={imageDownload}>
        <InterviewDocumentIntro title={result.title} intro={result.intro} search={search} />
        <InterviewQuestionAccordion questions={result.questions} search={search} />
      </InterviewImageDownload.Provider>
    </section>
  );
}

/** The document's own title and the text before its first question, as formatted Markdown. */
function InterviewDocumentIntro({ title, intro, search = null }: { title?: string; intro?: string; search?: RegExp | null }) {
  const ownTitle = title && title !== interviewNoteTitle ? title : null;
  if (!ownTitle && !intro) return null;
  // While searching, the intro shows only when the search occurs in it.
  if (search && !countSearchHits(ownTitle ?? "", search) && !countSearchHits(intro, search)) return null;
  return (
    <section className="interview-doc" aria-label="Einleitung">
      {ownTitle ? <h3 className="interview-doc__title">{highlightText(ownTitle, search)}</h3> : null}
      {intro ? <InterviewMarkdown value={intro} highlight={search} /> : null}
    </section>
  );
}

function InterviewEditor({
  mode,
  text,
  onTextChange,
  nextFileName,
  preview,
  previewIsCurrent,
  canSave,
  saving,
  saveError,
  onPreview,
  onSave,
  onCancel,
  cancellable,
}: {
  mode: EditorMode;
  text: string;
  onTextChange: (value: string) => void;
  nextFileName: string;
  preview: { text: string; result: InterviewParseResult } | null;
  previewIsCurrent: boolean;
  canSave: boolean;
  saving: boolean;
  saveError: string | null;
  onPreview: () => void;
  onSave: () => void;
  onCancel: () => void;
  cancellable: boolean;
}) {
  const textareaId = useId();
  return (
    <section className="interview-editor" aria-label="Fragen & Antworten einfügen">
      <h3>{mode.kind === "create" ? "Fragen & Antworten einfügen" : `„${mode.file.fileName}“ bearbeiten`}</h3>
      <p className="interview-prep__muted">
        {mode.kind === "create"
          ? `Fügen Sie alle Fragen mit Erklärung und Antwort in einem Schritt ein. Gespeichert wird als neue Datei „${nextFileName}“; vorhandene Dateien bleiben unverändert.`
          : "Die Änderungen werden wieder in genau dieser Datei gespeichert."}
      </p>
      <label className="field full" htmlFor={textareaId}>
        <span>Fragen, Erklärungen und Antworten</span>
      </label>
      <textarea
        id={textareaId}
        className="interview-editor__input"
        rows={14}
        value={text}
        maxLength={interviewNoteLimits.maxTextLength}
        placeholder={inputExample}
        spellCheck
        onChange={(event) => onTextChange(event.target.value)}
      />
      <small className="interview-prep__muted">
        Jede Frage beginnt am Zeilenanfang mit „Frage 1:“, gefolgt von „Erklärung:“ und „Antwort:“. Listen, Leerzeilen und
        Codeblöcke bleiben erhalten.
      </small>
      <div className="interview-editor__actions">
        <button type="button" className="button secondary" onClick={onPreview} disabled={saving}>
          <Eye size={16} /> Vorschau prüfen
        </button>
        <button type="button" className="button primary" onClick={onSave} disabled={!canSave}>
          <Save size={16} /> {saving ? "Wird gespeichert …" : "Als Markdown speichern"}
        </button>
        {cancellable || mode.kind === "edit" ? (
          <button type="button" className="button secondary" onClick={onCancel} disabled={saving}>
            Abbrechen
          </button>
        ) : null}
      </div>
      {saveError ? <p className="interview-prep__alert" role="alert">{saveError}</p> : null}
      {preview ? (
        <div className="interview-editor__preview" aria-label="Vorschau" role="region">
          {!previewIsCurrent ? (
            <p className="interview-prep__warning" role="status">
              Der Text wurde nach der Vorschau geändert. Bitte prüfen Sie die Vorschau erneut, bevor Sie speichern.
            </p>
          ) : null}
          <p className="interview-editor__summary" role="status">
            {preview.result.questions.length === 1
              ? "1 Frage erkannt."
              : `${preview.result.questions.length} Fragen erkannt.`}
            {hasBlockingIssues(preview.result) ? " Bitte beheben Sie die Fehler, bevor Sie speichern." : ""}
          </p>
          <IssueList result={preview.result} />
          <InterviewDocumentIntro title={preview.result.title} intro={preview.result.intro} />
          <InterviewQuestionAccordion key={preview.text} questions={preview.result.questions} />
        </div>
      ) : null}
    </section>
  );
}

function IssueList({ result }: { result: InterviewParseResult }) {
  if (!result.issues.length) return null;
  return (
    <ul className="interview-issues" aria-label="Hinweise zur Erkennung">
      {result.issues.map((issue, index) => (
        <li key={`${issue.line}-${index}`} className={`interview-issues__${issue.severity}`}>
          <strong>{issue.severity === "error" ? "Fehler" : "Hinweis"}:</strong> {issue.message}
        </li>
      ))}
    </ul>
  );
}

/** Every question and its Erklärung visible; each Antwort opens on its own, all closed at first. */
export function InterviewQuestionAccordion({
  questions,
  search = null,
}: {
  questions: readonly InterviewQuestion[];
  /** The panel's search: only questions with a hit are shown, hits are marked, an Antwort with a hit opens. */
  search?: RegExp | null;
}) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const matches = useMemo(() => questions.map((question) => ({
    answer: countSearchHits(question.answer, search) > 0,
    any: !search || [question.question, question.explanation, question.answer, question.following]
      .some((text) => countSearchHits(text, search) > 0),
  })), [questions, search]);
  // A new search opens every Antwort that contains it (answers opened before stay open).
  useEffect(() => {
    if (!search) return;
    setOpen((current) => {
      const next = new Set(current);
      matches.forEach((match, index) => { if (match.answer) next.add(index); });
      return next.size === current.size ? current : next;
    });
  }, [matches, search]);
  const baseId = useId();
  const toggle = (index: number) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  });
  const [jumpTarget, setJumpTarget] = useState<number | null>(null);
  /** The index: opens that question's Antwort and brings its card to the top of the panel. */
  const jumpTo = (index: number) => {
    setOpen((current) => (current.has(index) ? current : new Set(current).add(index)));
    setJumpTarget(index);
  };
  // After the Antwort has opened: scroll the card into view and move the focus to its Antwort button.
  useEffect(() => {
    if (jumpTarget === null) return;
    const card = document.getElementById(`${baseId}-karte-${jumpTarget}`);
    card?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    document.getElementById(`${baseId}-antwort-schalter-${jumpTarget}`)?.focus({ preventScroll: true });
    setJumpTarget(null);
  }, [baseId, jumpTarget]);
  if (!questions.length) return null;
  return (
    <>
    {questions.length > 1 && matches.some((match) => match.any) ? (
      <nav className="interview-index" aria-label="Fragenindex">
        <span className="interview-index__label">{search ? "Fragen mit Treffern" : "Fragenindex"}</span>
        <ol className="interview-index__list">
          {questions.map((question, index) => !matches[index].any ? null : (
            <li key={`${index}-${question.line}`}>
              <button
                type="button"
                className={`interview-index__item${open.has(index) ? " open" : ""}`}
                title={`Frage${question.number !== null ? ` ${question.number}` : ""}: ${question.question}`}
                aria-label={`Zu Frage ${question.number ?? index + 1} springen und Antwort öffnen`}
                onClick={() => jumpTo(index)}>
                {question.number ?? index + 1}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    ) : null}
    <ol className="interview-accordion">
      {questions.map((question, index) => {
        const expanded = open.has(index);
        const headingId = `${baseId}-frage-${index}`;
        const buttonId = `${baseId}-antwort-schalter-${index}`;
        const panelId = `${baseId}-antwort-${index}`;
        if (!matches[index].any) return null;
        return (
          <li key={`${index}-${question.line}`} className="interview-accordion__item">
          <article
            id={`${baseId}-karte-${index}`}
            className={`interview-question${expanded ? " open" : ""}`}
            aria-labelledby={headingId}>
            <header className="interview-question__header">
              <span className="interview-question__badge" aria-hidden="true">
                {question.number ?? "?"}
              </span>
              <h3 className="interview-question__heading" id={headingId}>
                <span className="interview-question__number">
                  Frage{question.number !== null ? ` ${question.number}` : ""}
                </span>
                <span className="interview-question__text">
                  {question.question ? highlightText(question.question, search) : "(ohne Fragetext)"}
                </span>
              </h3>
            </header>
            {/* A question without "Erklärung:" (e.g. a prepared document) shows no empty Erklärung box. */}
            {question.explanation !== undefined ? (
              <section className="interview-question__explanation" aria-label="Erklärung">
                <h4>Erklärung</h4>
                <InterviewText value={question.explanation} missing="Keine Erklärung hinterlegt." search={search} />
              </section>
            ) : null}
            <div className="interview-answer">
              <button
                id={buttonId}
                className="interview-answer__toggle"
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(index)}>
                <span className="interview-answer__label">Antwort</span>
                <span className="interview-answer__hint">{expanded ? "Ausblenden" : "Anzeigen"}</span>
                <ChevronDown className="interview-answer__chevron" size={18} aria-hidden="true" />
              </button>
              <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded} className="interview-answer__body">
                <InterviewText value={question.answer} missing="Keine Antwort hinterlegt." search={search} />
              </div>
            </div>
          </article>
          {question.following && (!search || countSearchHits(question.following, search) > 0) ? (
            // Only headings ("## Phase 5 – Abschluss"): a section title above the next question, no text box.
            <section
              className={`interview-doc${isOnlyHeadings(question.following) ? " interview-doc--section" : ""}`}
              aria-label="Weiterer Text">
              <InterviewMarkdown value={question.following} highlight={search} />
            </section>
          ) : null}
          </li>
        );
      })}
    </ol>
    </>
  );
}

/** User text as formatted Markdown (never HTML): headings, lists, tables, quotes, code and line breaks. */
function InterviewText({ value, missing, search = null }: { value: string | undefined; missing: string; search?: RegExp | null }) {
  if (!value?.trim()) return <p className="interview-text--missing">{missing}</p>;
  return <InterviewMarkdown value={value} highlight={search} />;
}
