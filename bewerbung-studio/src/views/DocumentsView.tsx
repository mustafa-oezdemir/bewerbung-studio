import { keepResumeLayoutOverrides, resolveResumePresentation, separateResumeDraft } from "../shared/resumePresentation";
import { applyResumeSpacingPreset, getResumeSpacingPreset, resumeSpacingFields } from "../shared/resumeSpacing";
import { resolveCvDocument } from "../shared/resolveCvDocument";
import { cvDesignLimits } from "../shared/cvDesignSchema";
import { applyCustomCvDesign, createCustomCvDesign, duplicateCustomCvDesign, updateCustomCvDesign } from "../shared/customCvDesign";
import type { ResumePresentation } from "../shared/resumePresentationSchema";
import { ContactIcon } from "../components/resume/templates/ContactIcon";
import { getPehlioneContacts } from "../shared/pehlioneContacts";
import {
  createDocumentDesignDraft,
  selectDocumentTemplate,
  resetDocumentDesign,
  persistDocumentDraft,
  updateCvDesignField,
  updateResumeAppearanceField,
  type DocumentDesignDraft,
} from "../shared/documentEditorState";
import { normalizeResumeDataDraft } from "../components/resume/ResumeDataEditor";
import { ManagedResumePreview } from "../components/resume/ManagedResumePreview";
import {
  ArrowLeft,
  ChevronUp,
  Download,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  FolderOpen,
  ImagePlus,
  Mail,
  Palette,
  PenLine,
  Save,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { TemplateThumbnail } from "../components/TemplateThumbnail";
import { KnowledgeSectionRenderer } from "../components/document/KnowledgeSectionRenderer";
import { DocumentBackgroundLayer } from "../components/document/DocumentBackgroundLayer";
import { ResizableSplitView } from "../components/layout/ResizableSplitView";
import { ResumeSectionsPanel } from "../components/resume/ResumeSectionsPanel";
import { ElegantResume } from "../components/resume/templates/elegant";
import { EinspaltigResume } from "../components/resume/templates/einspaltig";
import { GepflegtResume } from "../components/resume/templates/gepflegt";
import { KlassischResume } from "../components/resume/templates/klassisch";
import { KompaktResume } from "../components/resume/templates/kompakt";
import { KreativResume } from "../components/resume/templates/kreativ";
import { IvyLeagueResume } from "../components/resume/templates/ivy-league";
import { ModernResume } from "../components/resume/templates/modern";
import { PehlioneResume } from "../components/resume/templates/pehlione";
import { StilvollResume } from "../components/resume/templates/stilvoll";
import { TabellarischResume } from "../components/resume/templates/tabellarisch";
import { ZeitgenoessischResume } from "../components/resume/templates/zeitgenoessisch";
import { ZweispaltigResume } from "../components/resume/templates/zweispaltig";
import { analyzeKeywordMatch } from "../lib/keywordMatch";
import {
  applicationGreeting,
  applicationRecipientLines,
} from "../shared/applicationContacts";
import {
  formatApplicationDate,
  formatApplicationDateLong,
} from "../shared/applicationDate";
import {
  getApplicationDocumentItems,
  type ApplicationDocumentItem,
} from "../shared/applicationDocuments";
import {
  getApplicationEmail,
  resolveApplicationEmailAttachments,
} from "../shared/applicationEmail";
import {
  createCoverSubject,
  getCoverLetterAttachments,
  getCoverLetterMainBody,
} from "../shared/coverLetter";
import {
  getLetterPageStatus,
  type ResumePagePlan,
} from "../shared/documentPagination";
import { getResumeIdentityVisibilityCss } from "../shared/resumeIdentityVisibility";
import {
  defaultDocumentDesign,
  documentFonts,
  getDocumentDesignVariables,
  hasReadableColorContrast,
  type DocumentDesignSettings,
} from "../shared/documentDesign";
import { calculateA4PreviewScale } from "../shared/documentPreview";
import {
  getDeckblattCompetencies,
  getDeckblattContacts,
  getDeckblattDocuments,
} from "../shared/deckblatt";
import type { ProfileMediaKind } from "../shared/ipc";
import { getProfileMediaSource } from "../shared/profileMedia";
import {
  defaultResumePersonalFieldVisibility,
  getResumeSemanticSection,
} from "../features/resume-sections/resume-section-system";
import { resolveSelectedProfile } from "../shared/profileSelection";
import type {
  ApplicantProfile,
  Application,
  DocumentDraft,
} from "../shared/schema";
import {
  colorPresets,
  getReadableTextColor,
  getTemplate,
  templates,
} from "../shared/templates";
import { selectCurrentApplication, useAppStore } from "../store/useAppStore";

type Tab = "deckblatt" | "anschreiben" | "email" | "lebenslauf";

function ColorCard({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const [hex, setHex] = useState(value.toUpperCase());
  useEffect(() => setHex(value.toUpperCase()), [value]);
  const commit = (candidate: string) => {
    const normalized = candidate.startsWith("#") ? candidate : `#${candidate}`;
    if (/^#[0-9a-f]{6}$/i.test(normalized)) onChange(normalized.toUpperCase());
    else setHex(value.toUpperCase());
  };
  return <label className="design-color-card">
    <span>{label}</span>
    <span className="design-color-card__choice">
      <input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
      <input className="design-color-card__hex" type="text" aria-label={`${label} HEX`}
        inputMode="text" maxLength={7} value={hex}
        onChange={(event) => setHex(event.target.value.toUpperCase())}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(event.currentTarget.value); } }} />
    </span>
  </label>;
}

function DocumentListEditor({
  items,
  onChange,
}: {
  items: ApplicationDocumentItem[];
  onChange: (
    key: string,
    change: Partial<Pick<ApplicationDocumentItem, "label" | "isVisible">> & {
      isDeleted?: boolean;
    },
  ) => void;
}) {
  if (!items.length) {
    return <p className="document-list-empty">Keine Unterlagen ausgewählt.</p>;
  }

  return (
    <div className="document-list-editor">
      {items.map((item) => (
        <div className={item.isVisible ? "" : "is-hidden"} key={item.key}>
          <input
            aria-label={`Anzeigename für ${item.label}`}
            value={item.label}
            onChange={(event) =>
              onChange(item.key, { label: event.target.value })
            }
          />
          <button
            aria-label={
              item.isVisible
                ? `${item.label} ausblenden`
                : `${item.label} anzeigen`
            }
            className="icon-button"
            type="button"
            onClick={() => onChange(item.key, { isVisible: !item.isVisible })}>
            {item.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <button
            aria-label={`${item.label} aus der Liste entfernen`}
            className="icon-button danger"
            type="button"
            onClick={() => onChange(item.key, { isDeleted: true })}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

type ResumePreviewPageProps = {
  application: Application;
  atsMode: boolean;
  documents: DocumentDraft;
  name: string;
  plan: ResumePagePlan;
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
  totalPages: number;
};

function ResumePreviewPage({
  application,
  atsMode,
  documents,
  name,
  plan,
  profile,
  sections,
  totalPages,
}: ResumePreviewPageProps) {
  const experienceIds = new Set(
    plan.items
      .filter((item) => item.kind === "experience")
      .map((item) => item.id),
  );
  const educationIds = new Set(
    plan.items
      .filter((item) => item.kind === "education")
      .map((item) => item.id),
  );
  const experiences = (profile?.experiences ?? []).filter((entry) =>
    experienceIds.has(entry.id),
  );
  const education = (profile?.education ?? []).filter((entry) =>
    educationIds.has(entry.id),
  );
  const isContinuation = plan.pageNumber === 2;
  const initials = profile
    ? `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`
    : "VN";
  const photoSource = getProfileMediaSource(profile?.photoPath);
  const showResumeAvatar = !atsMode;
  const avatar = (
    <span className={`cv-avatar ${photoSource ? "has-image" : ""}`}>
      {photoSource ? (
        <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
      ) : (
        initials
      )}
    </span>
  );

  return (
    <div
      className={`resume-preview cv-${plan.density} ${isContinuation ? "cv-continuation" : ""}`}
      data-resume-page={plan.pageNumber}>
      <header className="cv-preview-header">
        <div>
          <p className="paper-kicker">
            {isContinuation ? "Lebenslauf · Fortsetzung" : "Lebenslauf"}
          </p>
          <h1>{name}</h1>
          <h2>{profile?.title || application.job.title}</h2>
          <p className="cv-contact-line">
            {getPehlioneContacts(profile).map((contact) => (
              <span key={contact.key} style={{ display: "inline-flex", alignItems: "center", gap: "1mm", marginRight: "3mm" }}>
                {!atsMode ? <ContactIcon kind={contact.key} /> : null}
                {contact.href ? <a href={contact.href}>{contact.value}</a> : contact.value}
              </span>
            ))}
          </p>
        </div>
        {showResumeAvatar ? avatar : null}
      </header>
      {atsMode && !isContinuation ? (
        <aside className="cv-preview-side">
          {sections.profile && (
            <section>
              <h3>Zusammenfassung</h3>
              <p>
                {documents.resumeProfile ||
                  profile?.summary ||
                  "Kurzprofil ergänzen …"}
              </p>
            </section>
          )}
          {sections.skills && (
            <KnowledgeSectionRenderer
              section={profile?.knowledgeSection}
              legacySkills={profile?.skills}
              atsMode={atsMode}
            />
          )}
          {sections.languages && profile?.languages.length ? (
            <section>
              <h3>Sprachen</h3>
              <div className="language-list">
                {profile.languages.map((language) => (
                  <p className="language-plain" key={language}>
                    <span>{language}</span>
                  </p>
                ))}
              </div>
            </section>
          ) : null}
          {sections.certifications && profile?.certifications.length ? (
            <section>
              <h3>Zertifikate</h3>
              <ul>
                {profile.certifications.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      ) : null}
      <main className="cv-preview-main">
        {sections.experience && experiences.length ? (
          <section>
            <h3>Berufserfahrung{isContinuation ? " · Fortsetzung" : ""}</h3>
            {experiences.map((entry) => (
              <article className="resume-entry" key={entry.id}>
                <div className="resume-entry-title">
                  <div>
                    <strong>{entry.role}</strong>
                    <p>{entry.company}</p>
                  </div>
                  <small>
                    {entry.from} – {entry.to}
                    <br />
                    {entry.city}
                  </small>
                </div>
                <ul>
                  {entry.achievements.filter(Boolean).map((achievement) => (
                    <li key={achievement}>{achievement}</li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        ) : null}
        {sections.education && education.length ? (
          <section>
            <h3>Ausbildung</h3>
            {education.map((entry) => (
              <article className="resume-entry education-entry" key={entry.id}>
                <div className="resume-entry-title">
                  <div>
                    <strong>{entry.degree}</strong>
                    <p>{entry.institution}</p>
                  </div>
                  <small>
                    {entry.from} – {entry.to}
                    <br />
                    {entry.city}
                  </small>
                </div>
              </article>
            ))}
          </section>
        ) : null}
        {!experiences.length && !education.length && plan.pageNumber === 1 ? (
          <p className="paper-muted">
            Berufserfahrung und Ausbildung im Profil ergänzen.
          </p>
        ) : null}
      </main>
      {!isContinuation && !atsMode ? (
        <aside className="cv-preview-side">
          <span
            className={`side-avatar cv-avatar ${photoSource ? "has-image" : ""}`}>
            {photoSource ? (
              <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
            ) : (
              initials
            )}
          </span>
          {sections.profile && (
            <section>
              <h3>Zusammenfassung</h3>
              <p>
                {documents.resumeProfile ||
                  profile?.summary ||
                  "Kurzprofil ergänzen …"}
              </p>
            </section>
          )}
          {sections.skills && (
            <KnowledgeSectionRenderer
              section={profile?.knowledgeSection}
              legacySkills={profile?.skills}
              atsMode={atsMode}
            />
          )}
          {sections.languages && profile?.languages.length ? (
            <section>
              <h3>Sprachen</h3>
              <div className="language-list">
                {profile.languages.map((language) => (
                  <p key={language}>
                    <span>{language}</span>
                    {atsMode ? null : <i>●●●●○</i>}
                  </p>
                ))}
              </div>
            </section>
          ) : null}
          {sections.certifications && profile?.certifications.length ? (
            <section>
              <h3>Zertifikate</h3>
              <ul>
                {profile.certifications.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      ) : null}
      <span className="preview-page-number">
        {plan.pageNumber} / {totalPages}
      </span>
    </div>
  );
}

export function DocumentsView({
  initialTab = "anschreiben",
  onOpenApplications,
}: {
  initialTab?: Tab;
  onOpenApplications?: () => void;
}) {
  const application = useAppStore(selectCurrentApplication);
  const profiles = useAppStore((state) => state.workspace.profiles);
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const selectActiveProfile = useAppStore((state) => state.selectProfile);
  const saveApplication = useAppStore((state) => state.saveApplication);
  const syncCoverLetter = useAppStore((state) => state.syncCoverLetter);
  const saveProfile = useAppStore((state) => state.saveProfile);
  const exportPdf = useAppStore((state) => state.exportPdf);
  const openFolder = useAppStore((state) => state.openFolder);
  const attachments = useAppStore((state) => state.workspace.attachments);
  const customCvDesigns = useAppStore((state) => state.workspace.customCvDesigns);
  const saveCustomCvDesign = useAppStore((state) => state.saveCustomCvDesign);
  const removeCustomCvDesign = useAppStore((state) => state.removeCustomCvDesign);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [designPanelOpen, setDesignPanelOpen] = useState(true);
  const [customDesignId, setCustomDesignId] = useState<string>();
  const [customDesignName, setCustomDesignName] = useState("");
  const [resumeSectionPreview, setResumeSectionPreview] = useState<{
    templateId: string;
    profile: ApplicantProfile;
  } | null>(null);
  const [resumeContentDraft, setResumeContentDraft] = useState<ApplicantProfile | null>(null);
  const [resumeEditorRevision, setResumeEditorRevision] = useState(0);
  const [documentPreview, setDocumentPreview] = useState<{
    applicationId: string;
    documents: DocumentDraft;
  } | null>(null);
  const handleResumeSectionPreview = useCallback(
    (templateId: string, previewProfile: ApplicantProfile | null) => {
      if (!previewProfile) {
        setResumeSectionPreview((current) => current?.templateId === templateId ? null : current);
        return;
      }
      const original = profiles.find((item) => item.id === previewProfile.id);
      if (!original) return;
      const separated = separateResumeDraft(original, previewProfile, templateId);
      setResumeContentDraft(separated.profile);
      setResumeSectionPreview({ templateId, profile: previewProfile });
      setDesign((current) => {
        if (current.templateId !== templateId) return current;
        const previous = current.settings.resumePresentation;
        const combined = keepResumeLayoutOverrides(separated.presentation, previous);
        const resumePresentation = Object.keys(combined).length ? combined : undefined;
        if (JSON.stringify(current.settings.resumePresentation) === JSON.stringify(resumePresentation)) return current;
        return { ...current, settings: { ...current.settings, resumePresentation } };
      });
    },
    [profiles],
  );
  const [designDraft, setDesign] = useState<DocumentDesignDraft>(() =>
    application
      ? createDocumentDesignDraft(application)
      : {
          applicationId: "",
          templateId: templates[0].id,
          accentColor: templates[0].accent,
          secondaryColor: templates[0].secondary,
          settings: defaultDocumentDesign,
          templateDesigns: {},
        },
  );
  const design =
    application && designDraft.applicationId !== application.id
      ? createDocumentDesignDraft(application)
      : designDraft;
  const persistedDocuments = JSON.stringify(application?.documents);
  const formRef = useRef<HTMLFormElement>(null);
  const paperStageRef = useRef<HTMLElement>(null);
  const letterPaperRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  useLayoutEffect(() => {
    const stage = paperStageRef.current;
    if (!stage) return;

    const fitPaperToStage = () => {
      const stageStyle = window.getComputedStyle(stage);
      const availableWidth =
        stage.clientWidth -
        Number.parseFloat(stageStyle.paddingLeft) -
        Number.parseFloat(stageStyle.paddingRight) -
        2;
      const availableHeight =
        stage.clientHeight -
        Number.parseFloat(stageStyle.paddingTop) -
        Number.parseFloat(stageStyle.paddingBottom) -
        2;
      const nextScale = calculateA4PreviewScale(
        availableWidth,
        availableHeight,
      );
      setPreviewScale((current) =>
        Math.abs(current - nextScale) < 0.001 ? current : nextScale,
      );
    };

    stage.scrollTo({ top: 0 });
    fitPaperToStage();
    const observer = new ResizeObserver(fitPaperToStage);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [application, tab]);

  const fitLetterContent = useCallback(() => {
    const paper = letterPaperRef.current;
    const content = paper?.querySelector<HTMLElement>(".letter-preview");
    if (!paper || !content) return;

    content.style.removeProperty("transform");
    content.style.width = "100%";
    content.dataset.fitScale = "1.000";

    const heightRatio = paper.clientHeight / Math.max(content.scrollHeight, 1);
    const widthRatio = paper.clientWidth / Math.max(content.scrollWidth, 1);
    const scale = Math.min(1, heightRatio, widthRatio);
    if (scale < 0.999) {
      content.style.transform = `scale(${scale})`;
      content.style.width = `${100 / scale}%`;
      content.dataset.fitScale = scale.toFixed(3);
    }
  }, []);

  useLayoutEffect(() => {
    if (tab !== "anschreiben") return;
    fitLetterContent();
    void document.fonts?.ready.then(fitLetterContent);
    const signature =
      letterPaperRef.current?.querySelector<HTMLImageElement>(
        ".signature-image",
      );
    signature?.addEventListener("load", fitLetterContent);
    return () => signature?.removeEventListener("load", fitLetterContent);
  }, [
    application,
    design,
    documentPreview,
    fitLetterContent,
    profiles,
    resumeSectionPreview,
    tab,
  ]);

  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => {
    if (!application || application.id === designDraft.applicationId) return;
    setDesign(createDocumentDesignDraft(application));
  }, [application, designDraft.applicationId]);
  useEffect(() => {
    if (!application) {
      setDocumentPreview(null);
      return;
    }
    setDocumentPreview({
      applicationId: application.id,
      documents: application.documents,
    });
  }, [application?.id, persistedDocuments]);

  if (!application) {
    return (
      <section className="surface empty-detail">
        <div className="empty-state">
          <FileText size={28} />
          <h3>Noch keine Bewerbung</h3>
          <p>Legen Sie zuerst eine Bewerbung an, um Unterlagen zu erstellen.</p>
        </div>
      </section>
    );
  }
  const profile = resolveSelectedProfile(
    profiles,
    selectedProfileId,
    application.profileId,
  );
  const photoSource = getProfileMediaSource(profile?.photoPath);
  const signatureSource = getProfileMediaSource(profile?.signaturePath);
  const docs =
    documentPreview?.applicationId === application.id
      ? documentPreview.documents
      : application.documents;
  const deckblattContacts = getDeckblattContacts(
    profile,
    docs.coverSheetContactVisibility,
  );
  const deckblattCompetencies = getDeckblattCompetencies(profile, application);
  const deckblattDocuments = getDeckblattDocuments(
    attachments,
    application.id,
    docs.documentListSettings,
  );
  const coverLetterAttachments = getCoverLetterAttachments(
    attachments,
    application.id,
    docs.documentListSettings,
  );
  const applicationDocumentItems = getApplicationDocumentItems(
    attachments,
    application.id,
    docs.documentListSettings,
  );
  const template = getTemplate(design.templateId);
  const spacingPreset = getResumeSpacingPreset(template.id, design.settings);
  const contentProfile = resumeContentDraft?.id === profile?.id ? resumeContentDraft : profile;
  const editorProfile = resolveResumePresentation(contentProfile, template.id, design.settings.resumePresentation);
  const renderProfile =
    resumeSectionPreview?.templateId === template.id &&
    resumeSectionPreview.profile.id === profile?.id
      ? resumeSectionPreview.profile
      : editorProfile;
  const resolvedCv = resolveCvDocument({
    profile: renderProfile,
    templateId: template.id,
    settings: design.settings,
    resumeProfile: docs.resumeProfile,
    deckblattStatement: docs.deckblattStatement,
    jobTitle: application.job.title,
    presentationAlreadyApplied: true,
  });
  const resumeRenderProfile = resolvedCv.profile;
  const resumeLayout = resolvedCv.layout;
  const resumeSpacing = resolvedCv.design;
  const appearanceDefaults = template.id === "pehlione_white_blue"
    ? { sidebarBackgroundColor: "#0b3d86", sidebarTextColor: "#ffffff",
      mainBackgroundColor: "#ffffff", photoDecorationColor: "#d9ebff", contactDividerColor: "#ffffff" }
    : template.id === "pehlione_white"
      ? { sidebarBackgroundColor: "#ffffff", sidebarTextColor: "#142235",
        mainBackgroundColor: "#ffffff", photoDecorationColor: "#dcecff", contactDividerColor: design.accentColor }
      : { sidebarBackgroundColor: resumeSpacing.colors.background, sidebarTextColor: resumeSpacing.colors.text,
        mainBackgroundColor: resumeSpacing.colors.background, photoDecorationColor: design.accentColor,
        contactDividerColor: resumeSpacing.colors.divider };
  const emailAttachments = resolveApplicationEmailAttachments(
    docs,
    deckblattDocuments,
  );
  const email = getApplicationEmail(
    { ...application, documents: docs },
    profile,
    emailAttachments,
  );
  const sections = resolvedCv.sections;
  const keywordMatch = analyzeKeywordMatch(application, renderProfile);
  const name = renderProfile
    ? `${renderProfile.firstName} ${renderProfile.lastName}`
    : "Vorname Nachname";
  const senderContactDetails = renderProfile
    ? [
        renderProfile.street,
        `${renderProfile.postalCode} ${renderProfile.city}`.trim(),
        renderProfile.email,
        renderProfile.phone,
      ]
        .filter(Boolean)
        .join(" | ")
    : "Adresse | E-Mail | Telefon";
  const recipientLines = docs.coverRecipientAddress.trim()
    ? docs.coverRecipientAddress
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : applicationRecipientLines(application);
  const coverSenderName = docs.coverSenderName || name;
  const coverSenderTitle =
    docs.coverSenderTitle || renderProfile?.title || application.job.title;
  const coverSheetProfessionalTitle =
    docs.coverSheetProfessionalTitle ||
    renderProfile?.title ||
    application.job.title;
  const coverSenderContact = docs.coverSenderContact || senderContactDetails;
  const coverGreeting = docs.coverGreeting || applicationGreeting(application);
  const pehlioneResumeProfile = resolvedCv.paginationSummary;
  const resumePlan = resolvedCv.pagePlan;
  const letterStatus = getLetterPageStatus(docs);
  const isAtsMode =
    design.settings.resumeOutputMode === "ats" ||
    design.settings.columnLayout === "compact-ats";
  const effectiveColumnLayout = isAtsMode
    ? "compact-ats"
    : design.settings.columnLayout;
  const paperStyle = {
    "--doc-accent": design.accentColor,
    "--doc-secondary": design.secondaryColor,
    "--doc-on-secondary": getReadableTextColor(design.secondaryColor),
    ...getDocumentDesignVariables(design.settings),
  } as CSSProperties;
  const designClassName = `column-${effectiveColumnLayout} background-${design.settings.backgroundId} background-scope-${design.settings.backgroundScope} ${
    design.settings.showBackgroundInPrint
      ? "print-background"
      : "no-print-background"
  }`;
  const textContrastIsReadable = hasReadableColorContrast(
    resumeSpacing.colors.paragraph,
    resumeSpacing.colors.background,
  );
  const sidebarContrastIsReadable = hasReadableColorContrast(
    design.settings.resumeAppearance?.sidebarTextColor ?? appearanceDefaults.sidebarTextColor,
    design.settings.resumeAppearance?.sidebarBackgroundColor ?? appearanceDefaults.sidebarBackgroundColor,
  );

  const updateDesignSetting = <Key extends keyof DocumentDesignSettings>(
    key: Key,
    value: DocumentDesignSettings[Key],
  ) => {
    setDesign((current) => {
      const spacingKey = ({ marginLevel: "pageMarginMm", paddingLevel: "innerPaddingMm",
        sectionSpacingLevel: "sectionGapMm" } as Record<string, "pageMarginMm" | "innerPaddingMm" | "sectionGapMm">)[key];
      const base = spacingKey ? updateCvDesignField(current, "spacing", spacingKey, undefined)
        : key === "lineHeightLevel" ? updateCvDesignField(current, "typography", "lineHeight", undefined) : current;
      return { ...base, settings: { ...base.settings, [key]: value } };
    });
  };
  const updateResumeAppearance = <Key extends keyof NonNullable<DocumentDesignSettings["resumeAppearance"]>>(
    key: Key,
    value: NonNullable<DocumentDesignSettings["resumeAppearance"]>[Key],
  ) => setDesign((current) => updateResumeAppearanceField(current, key, value));
  const updateResumeLayout = <Key extends "layoutMode" | "sidebarSide" | "sidebarWidthPercent">(
    key: Key,
    value: ResumePresentation[Key],
  ) => {
    setDesign((current) => {
      const { resumePresentation, ...settings } = current.settings;
      const next: ResumePresentation = { ...resumePresentation, [key]: value };
      if (key === "layoutMode" && value === undefined) {
        delete next.layoutMode;
        delete next.sidebarSide;
        delete next.sidebarWidthPercent;
      } else if (value === undefined) delete next[key];
      return { ...current, settings: { ...settings, ...(Object.keys(next).length ? { resumePresentation: next } : {}) } };
    });
  };
  const updateClosingLayout = (key: "placement" | "alignment", value: "footer" | "main" | "left" | "center" | "right" | "distributed") => {
    setDesign((current) => ({ ...current, settings: { ...current.settings,
      resumePresentation: { ...current.settings.resumePresentation,
        closing: { ...current.settings.resumePresentation?.closing, [key]: value } },
    } }));
  };
  const storeCustomDesign = () => {
    const name = customDesignName.trim();
    if (!name) return;
    const existing = customCvDesigns.find((item) => item.id === customDesignId);
    const saved = existing ? updateCustomCvDesign(existing, name, design) : createCustomCvDesign(name, design);
    void saveCustomCvDesign(saved);
    setCustomDesignId(saved.id);
    setCustomDesignName(saved.name);
  };
  const chooseCustomDesign = (id: string) => {
    const selected = customCvDesigns.find((item) => item.id === id);
    if (!selected) return;
    setDesign((current) => applyCustomCvDesign(selected, current));
    setCustomDesignId(selected.id);
    setCustomDesignName(selected.name);
    setResumeSectionPreview(null);
    setResumeEditorRevision((value) => value + 1);
  };
  const copyCustomDesign = () => {
    const selected = customCvDesigns.find((item) => item.id === customDesignId);
    if (!selected) return;
    const copy = duplicateCustomCvDesign(selected);
    void saveCustomCvDesign(copy);
    setCustomDesignId(copy.id);
    setCustomDesignName(copy.name);
  };
  const deleteCustomDesign = () => {
    const selected = customCvDesigns.find((item) => item.id === customDesignId);
    if (!selected || !window.confirm(`Design „${selected.name}“ wirklich löschen?`)) return;
    void removeCustomCvDesign(selected.id);
    setCustomDesignId(undefined);
    setCustomDesignName("");
  };
  const resetAllDesignSettings = () => {
    const changed = Boolean(design.settings.cvOverrides || design.settings.resumeAppearance ||
      design.settings.resumePresentation || design.settings.metadataLayout || design.settings.metadataOrder);
    if (changed && !window.confirm("Alle Design-Anpassungen dieses Lebenslaufs auf die Standardwerte der Vorlage zurücksetzen?")) return;
    setDesign(resetDocumentDesign);
    setResumeSectionPreview(null);
    setResumeEditorRevision((value) => value + 1);
  };

  const updateDocumentListItem = (
    key: string,
    change: Partial<Pick<ApplicationDocumentItem, "label" | "isVisible">> & {
      isDeleted?: boolean;
    },
  ) => {
    const item = applicationDocumentItems.find(
      (candidate) => candidate.key === key,
    );
    if (!item) return;
    const current = docs.documentListSettings.find(
      (setting) => setting.key === key,
    );
    const nextSetting = {
      key,
      label: current?.label || item.label,
      isVisible: current?.isVisible ?? item.isVisible,
      isDeleted: current?.isDeleted ?? false,
      ...change,
    };
    setDocumentPreview({
      applicationId: application.id,
      documents: {
        ...docs,
        documentListSettings: [
          ...docs.documentListSettings.filter((setting) => setting.key !== key),
          nextSetting,
        ],
      },
    });
  };

  const setCoverLetterAttachmentsVisible = (isVisible: boolean) => {
    setDocumentPreview({
      applicationId: application.id,
      documents: {
        ...docs,
        showCoverLetterAttachments: isVisible,
      },
    });
  };

  const reduceCoverSubjectGap = () => {
    setDocumentPreview({
      applicationId: application.id,
      documents: {
        ...docs,
        coverSubjectGapReduction: Math.min(
          4,
          docs.coverSubjectGapReduction + 1,
        ),
      },
    });
  };

  const resetCoverSubjectGap = () => {
    setDocumentPreview({
      applicationId: application.id,
      documents: { ...docs, coverSubjectGapReduction: 0 },
    });
  };

  const saveResumeSections = async (changedProfile: ApplicantProfile) => {
    if (!profile) return;
    const separated = separateResumeDraft(profile, changedProfile, template.id);
    const savedProfile = { ...separated.profile, updatedAt: new Date().toISOString() };
    const snapshot = applicationSnapshot(formRef.current);
    snapshot.designSettings = { ...snapshot.designSettings,
      resumePresentation: keepResumeLayoutOverrides(separated.presentation, design.settings.resumePresentation) };
    await persistDocumentDraft(snapshot, savedProfile, saveProfile, saveApplication);
    setResumeContentDraft(savedProfile);
  };

  const pickProfileMedia = async (kind: ProfileMediaKind) => {
    if (!profile || !window.bewerbungsManager) return;
    const selected =
      await window.bewerbungsManager.media.pickProfileImage(kind);
    if (!selected) return;
    await saveResumeSections({
      ...(resumeSectionPreview?.profile.id === profile.id
        ? resumeSectionPreview.profile
        : editorProfile ?? profile),
      [kind === "photo" ? "photoPath" : "signaturePath"]: selected.dataUrl,
      updatedAt: new Date().toISOString(),
    });
  };

  const removeProfileMedia = async (kind: ProfileMediaKind) => {
    if (!profile) return;
    await saveResumeSections({
      ...(resumeSectionPreview?.profile.id === profile.id
        ? resumeSectionPreview.profile
        : editorProfile ?? profile),
      [kind === "photo" ? "photoPath" : "signaturePath"]: "",
      updatedAt: new Date().toISOString(),
    });
  };

  const applicationSnapshot = (form: HTMLFormElement | null): Application => {
    const data = form ? new FormData(form) : null;
    const value = (name: string, fallback: string) => {
      const current = data?.get(name);
      return typeof current === "string" ? current : fallback;
    };
    return {
      ...application,
      profileId: profile?.id,
      templateId: design.templateId,
      accentColor: design.accentColor,
      secondaryColor: design.secondaryColor,
      designSettings: design.settings,
      templateDesigns: design.templateDesigns,
      documents: {
        coverSenderName: value("coverSenderName", docs.coverSenderName),
        coverSenderTitle: value("coverSenderTitle", docs.coverSenderTitle),
        coverSenderContact: value(
          "coverSenderContact",
          docs.coverSenderContact,
        ),
        coverSheetProfessionalTitle: value(
          "coverSheetProfessionalTitle",
          docs.coverSheetProfessionalTitle,
        ),
        coverSheetContactVisibility: docs.coverSheetContactVisibility,
        coverRecipientAddress: value(
          "coverRecipientAddress",
          docs.coverRecipientAddress,
        ),
        coverSubject: value("coverSubject", docs.coverSubject),
        coverSubjectGapReduction: docs.coverSubjectGapReduction,
        coverGreeting: value("coverGreeting", docs.coverGreeting),
        coverIntroduction: value("coverIntroduction", docs.coverIntroduction),
        coverMainBody: value("coverMainBody", getCoverLetterMainBody(docs)),
        coverMotivation: data?.has("coverMainBody") ? "" : docs.coverMotivation,
        coverQualification: data?.has("coverMainBody")
          ? ""
          : docs.coverQualification,
        coverCompanyFit: value("coverCompanyFit", docs.coverCompanyFit),
        coverExtraParagraph: value(
          "coverExtraParagraph",
          docs.coverExtraParagraph,
        ),
        coverClosing: value("coverClosing", docs.coverClosing),
        resumeProfile: value("resumeProfile", docs.resumeProfile),
        deckblattStatement: value(
          "deckblattStatement",
          docs.deckblattStatement,
        ),
        emailSubject: value("emailSubject", docs.emailSubject),
        emailMessage: value("emailMessage", docs.emailMessage),
        emailAttachmentNote: value("emailAttachmentNote", ""),
        emailAttachmentMode: docs.emailAttachmentMode,
        emailPackageFileName: value(
          "emailPackageFileName",
          docs.emailPackageFileName,
        ),
        showCoverLetterAttachments: docs.showCoverLetterAttachments,
        documentListSettings: docs.documentListSettings,
      },
    };
  };

  const changeDocumentProfile = async (profileId: string) => {
    selectActiveProfile(profileId);
    setResumeSectionPreview(null);
    await saveApplication({
      ...applicationSnapshot(formRef.current),
      profileId,
      updatedAt: new Date().toISOString(),
    });
  };

  const previewDocumentInput = (event: React.FormEvent<HTMLFormElement>) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLTextAreaElement)
    ) {
      return;
    }
    const name = target.name as keyof DocumentDraft;
    if (!name || !(name in docs)) return;
    setDocumentPreview({
      applicationId: application.id,
      documents: { ...docs, [name]: target.value },
    });
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const snapshot = applicationSnapshot(event.currentTarget);
    await persistDocumentDraft(
      snapshot,
      currentProfileDraft(),
      saveProfile,
      saveApplication,
    );
    if (tab === "anschreiben") {
      await syncCoverLetter(snapshot.id);
    }
  };

  const currentProfileDraft = () =>
    resumeContentDraft?.id === profile?.id && resumeContentDraft
      ? normalizeResumeDataDraft(resumeContentDraft)
      : undefined;

  const exportCurrentPdf = async (
    target: "deckblatt" | "anschreiben" | "lebenslauf" | "mappe",
  ) => {
    const snapshot = applicationSnapshot(formRef.current);
    await persistDocumentDraft(
      snapshot,
      currentProfileDraft(),
      saveProfile,
      saveApplication,
    );
    await exportPdf(snapshot.id, target, snapshot);
  };

  return (
    <div className="document-workspace">
      <section className="document-toolbar surface">
        <div>
          <p className="eyebrow">Synchronisiertes Bewerbungsset</p>
          <h2>{application.company.name}</h2>
          <p>
            {template.name} · {application.job.title}
          </p>
        </div>
        <div className="toolbar-buttons">
          {onOpenApplications ? (
            <button
              className="button secondary"
              type="button"
              aria-label="Zur ausgewählten aktiven Bewerbung"
              onClick={onOpenApplications}>
              <ArrowLeft size={17} /> Aktive Bewerbungen
            </button>
          ) : null}
          <button
            className="button secondary"
            onClick={() => void openFolder(application.id)}>
            <FolderOpen size={17} /> Ordner
          </button>
          {tab !== "email" ? (
            <button
              className="button secondary"
              onClick={() => void exportCurrentPdf(tab)}>
              <FileDown size={17} />{" "}
              {tab === "deckblatt"
                ? "Deckblatt"
                : tab === "anschreiben"
                  ? "Anschreiben"
                  : "Lebenslauf"}{" "}
              PDF
            </button>
          ) : null}
          <button
            className="button primary"
            onClick={() => void exportCurrentPdf("mappe")}>
            <Download size={17} /> Bewerbungsmappe
          </button>
        </div>
      </section>
      <ResizableSplitView
        className="document-layout"
        minPrimary={500}
        minSecondary={450}
        persistKey="resume-editor-layout"
        primary={
          <aside className="document-editor surface">
            <div className="document-tabs">
              <button
                className={tab === "deckblatt" ? "active" : ""}
                onClick={() => setTab("deckblatt")}>
                Deckblatt
              </button>
              <button
                className={tab === "anschreiben" ? "active" : ""}
                onClick={() => setTab("anschreiben")}>
                Anschreiben
              </button>
              <button
                className={tab === "email" ? "active" : ""}
                onClick={() => setTab("email")}>
                E-Mail
              </button>
              <button
                className={tab === "lebenslauf" ? "active" : ""}
                onClick={() => setTab("lebenslauf")}>
                Lebenslauf
              </button>
            </div>
            <form
              key={application.id}
              ref={formRef}
              onInput={previewDocumentInput}
              onSubmit={(event) => void save(event)}>
              {tab === "lebenslauf" && profiles.length ? (
                <label className="field document-profile-selector">
                  <span>Lebenslaufprofil</span>
                  <select
                    value={profile?.id ?? ""}
                    onChange={(event) =>
                      void changeDocumentProfile(event.target.value)
                    }>
                    {profiles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                        {item.title ? ` · ${item.title}` : ""}
                      </option>
                    ))}
                  </select>
                  <small>
                    Die Auswahl aktualisiert Lebenslaufdaten, Vorschau und PDF.
                  </small>
                </label>
              ) : null}
              {tab === "deckblatt" && (
                <div className="cover-letter-editor-sections">
                  <label className="field">
                    <span>Berufsbezeichnung auf dem Deckblatt</span>
                    <input
                      name="coverSheetProfessionalTitle"
                      defaultValue={coverSheetProfessionalTitle}
                      placeholder="z. B. Sachbearbeitung / Kundenservice"
                    />
                    <small>
                      Nur diese Bewerbung wird geändert; das Masterprofil bleibt
                      unverändert.
                    </small>
                  </label>
                  <label className="field">
                    <span>Kurzprofil auf dem Deckblatt</span>
                    <textarea
                      name="deckblattStatement"
                      rows={8}
                      defaultValue={docs.deckblattStatement}
                      placeholder="Prägnante Positionierung in zwei bis drei Sätzen …"
                    />
                  </label>
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>Bewerbungsunterlagen</b>
                      <small>
                        Nur ausgewählte, sichtbare Dokumente erscheinen auf dem
                        Deckblatt.
                      </small>
                    </header>
                    <DocumentListEditor
                      items={applicationDocumentItems}
                      onChange={updateDocumentListItem}
                    />
                  </section>
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>Kontakt auf dem Deckblatt</b>
                      <small>
                        Felder unabhängig vom Lebenslauf ein- oder ausblenden.
                      </small>
                    </header>
                    <div className="visibility-checkbox-grid">
                      {(
                        [
                          ["address", "Adresse"],
                          ["phone", "Telefon"],
                          ["email", "E-Mail"],
                          ["linkedin", "LinkedIn"],
                          ["github", "GitHub"],
                          ["website", "Website"],
                        ] as const
                      ).map(([key, label]) => (
                        <label className="checkbox-field compact" key={key}>
                          <input
                            type="checkbox"
                            checked={docs.coverSheetContactVisibility[key]}
                            onChange={(event) =>
                              setDocumentPreview({
                                applicationId: application.id,
                                documents: {
                                  ...docs,
                                  coverSheetContactVisibility: {
                                    ...docs.coverSheetContactVisibility,
                                    [key]: event.target.checked,
                                  },
                                },
                              })
                            }
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                </div>
              )}
              {tab === "anschreiben" && (
                <div className="cover-letter-editor-sections">
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>1. Briefkopf</b>
                      <small>
                        Automatisch ausgefüllt – bei Bedarf direkt anpassen
                      </small>
                    </header>
                    <label className="field">
                      <span>Name</span>
                      <input
                        name="coverSenderName"
                        defaultValue={coverSenderName}
                      />
                    </label>
                    <label className="field">
                      <span>Berufsbezeichnung</span>
                      <input
                        name="coverSenderTitle"
                        defaultValue={coverSenderTitle}
                      />
                    </label>
                    <label className="field">
                      <span>Kontaktzeile</span>
                      <input
                        name="coverSenderContact"
                        defaultValue={coverSenderContact}
                      />
                    </label>
                    <label className="field">
                      <span>Empfängeradresse</span>
                      <textarea
                        name="coverRecipientAddress"
                        rows={5}
                        defaultValue={recipientLines.join("\n")}
                      />
                    </label>
                  </section>
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>2. Betreffzeile</b>
                      <small>Stelle und Referenz eindeutig benennen</small>
                    </header>
                    <label className="field">
                      <span>Betreffzeile</span>
                      <input
                        name="coverSubject"
                        defaultValue={createCoverSubject(
                          application.job.title,
                          docs.coverSubject,
                        )}
                      />
                    </label>
                    <div className="cover-subject-spacing-control">
                      <div>
                        <b>Abstand vor Betreff</b>
                        <small>
                          {docs.coverSubjectGapReduction
                            ? `${docs.coverSubjectGapReduction} Zeile${docs.coverSubjectGapReduction === 1 ? "" : "n"} nach oben verschoben`
                            : "Standardabstand"}
                        </small>
                      </div>
                      <div>
                        <button
                          type="button"
                          disabled={docs.coverSubjectGapReduction === 4}
                          onClick={reduceCoverSubjectGap}>
                          <ChevronUp size={15} />
                          Betreff höher
                        </button>
                        {docs.coverSubjectGapReduction ? (
                          <button type="button" onClick={resetCoverSubjectGap}>
                            Standard
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </section>
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>3. Anrede</b>
                      <small>
                        Automatisch ausgefüllt – bei Bedarf direkt anpassen
                      </small>
                    </header>
                    <label className="field">
                      <span>Anrede</span>
                      <input
                        name="coverGreeting"
                        defaultValue={coverGreeting}
                      />
                    </label>
                  </section>
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>4. Einleitung</b>
                      <small>
                        2–3 prägnante Sätze mit direktem Stellenbezug
                      </small>
                    </header>
                    <label className="field">
                      <span>Einleitung</span>
                      <textarea
                        name="coverIntroduction"
                        rows={4}
                        defaultValue={docs.coverIntroduction}
                      />
                    </label>
                  </section>
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>5. Hauptteil</b>
                      <small>Die 2–3 stärksten belegbaren Argumente</small>
                    </header>
                    <label className="field">
                      <span>Hauptteil</span>
                      <textarea
                        name="coverMainBody"
                        rows={8}
                        defaultValue={getCoverLetterMainBody(docs)}
                      />
                    </label>
                    <label className="field">
                      <span>Zusatzabsatz (optional)</span>
                      <textarea
                        name="coverExtraParagraph"
                        rows={4}
                        defaultValue={docs.coverExtraParagraph}
                        placeholder="Optionaler zusätzlicher Absatz – leer lassen, wenn er nicht benötigt wird."
                      />
                    </label>
                  </section>
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>6. Unternehmensbezug</b>
                      <small>
                        Aufgabe, passende Erfahrung und künftiger Beitrag
                      </small>
                    </header>
                    <label className="field">
                      <span>Unternehmensbezug</span>
                      <textarea
                        name="coverCompanyFit"
                        rows={5}
                        defaultValue={docs.coverCompanyFit}
                      />
                    </label>
                  </section>
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>7. Schlussteil</b>
                      <small>Kurzer Übergang zum persönlichen Gespräch</small>
                    </header>
                    <label className="field">
                      <span>Schlussteil</span>
                      <textarea
                        name="coverClosing"
                        rows={5}
                        defaultValue={docs.coverClosing}
                      />
                    </label>
                  </section>
                  <section className="cover-letter-editor-section is-generated">
                    <header>
                      <b>8. Grußformel</b>
                      <small>Professioneller Abschluss und Unterschrift</small>
                    </header>
                    <p>Mit freundlichen Grüßen</p>
                    <div className="document-media-inline">
                      <span>Unterschrift</span>
                      <DocumentMediaCard
                        kind="signature"
                        label="Unterschrift"
                        source={signatureSource}
                        disabled={!profile}
                        onPick={() => void pickProfileMedia("signature")}
                        onRemove={() => void removeProfileMedia("signature")}
                      />
                    </div>
                  </section>
                  <section className="cover-letter-editor-section is-generated">
                    <header>
                      <b>9. Anlagen</b>
                      <small>
                        Namen ändern, Einträge ausblenden oder entfernen
                      </small>
                    </header>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={docs.showCoverLetterAttachments}
                        onChange={(event) =>
                          setCoverLetterAttachmentsVisible(event.target.checked)
                        }
                      />
                      <span>
                        Abschnitt „9. Anlagen“ im Anschreiben anzeigen
                      </span>
                    </label>
                    {docs.showCoverLetterAttachments ? (
                      <DocumentListEditor
                        items={applicationDocumentItems.filter(
                          (item) => item.key !== "anschreiben",
                        )}
                        onChange={updateDocumentListItem}
                      />
                    ) : (
                      <p className="document-list-empty">
                        Der komplette Anlagenabschnitt ist ausgeblendet.
                      </p>
                    )}
                  </section>
                  <section
                    className={`page-limit-status ${letterStatus.isOverRecommendedLength ? "warning" : "ok"}`}>
                    <strong>Anschreiben: 1 A4-Seite</strong>
                    <span>
                      {letterStatus.characterCount.toLocaleString("de-DE")} /{" "}
                      {letterStatus.recommendedMaximum.toLocaleString("de-DE")}{" "}
                      empfohlene Zeichen
                    </span>
                    <small>
                      {letterStatus.isOverRecommendedLength
                        ? "Vorschau und PDF-Export werden automatisch auf eine A4-Seite eingepasst. Kürzen verbessert die Lesbarkeit."
                        : "Der aktuelle Text liegt im gut lesbaren Ein-Seiten-Bereich."}
                    </small>
                  </section>
                  <p className="word-sync-note">
                    Beim Speichern wird die Word-Datei aus der persönlichen
                    Anschreiben-Vorlage im Bewerbungsordner erstellt oder
                    aktualisiert.
                  </p>
                </div>
              )}
              {tab === "email" && (
                <div className="email-editor-sections">
                  <section className="cover-letter-editor-section is-generated">
                    <header>
                      <b>Automatische E-Mail-Daten</b>
                      <small>
                        Anrede, Betreff und Absender werden aus Bewerbung und
                        Profil übernommen
                      </small>
                    </header>
                    <dl className="email-editor-metadata">
                      <div>
                        <dt>Betreff</dt>
                        <dd>{email.subject}</dd>
                      </div>
                      <div>
                        <dt>Anrede</dt>
                        <dd>{email.salutation}</dd>
                      </div>
                      <div>
                        <dt>Empfänger</dt>
                        <dd>{email.recipientName || "Nicht angegeben"}</dd>
                      </div>
                      <div>
                        <dt>E-Mail</dt>
                        <dd>{email.recipientEmail || "Nicht angegeben"}</dd>
                      </div>
                      <div>
                        <dt>Absender</dt>
                        <dd>{email.senderName || "Nicht angegeben"}</dd>
                      </div>
                      <div>
                        <dt>Absender-E-Mail</dt>
                        <dd>{email.senderEmail || "Nicht angegeben"}</dd>
                      </div>
                    </dl>
                  </section>
                  <label className="field">
                    <span>Nachricht</span>
                    <textarea
                      name="emailMessage"
                      rows={8}
                      defaultValue={email.message}
                    />
                  </label>
                  <section className="cover-letter-editor-section">
                    <header>
                      <b>Anlagen</b>
                      <small>
                        Die Liste wird aus dem tatsächlichen Versandmodus
                        erzeugt.
                      </small>
                    </header>
                    <div className="segmented-design-control">
                      <button
                        className={
                          docs.emailAttachmentMode === "package"
                            ? "selected"
                            : ""
                        }
                        type="button"
                        onClick={() =>
                          setDocumentPreview({
                            applicationId: application.id,
                            documents: {
                              ...docs,
                              emailAttachmentMode: "package",
                            },
                          })
                        }>
                        Gesamt-PDF
                      </button>
                      <button
                        className={
                          docs.emailAttachmentMode === "separate"
                            ? "selected"
                            : ""
                        }
                        type="button"
                        onClick={() =>
                          setDocumentPreview({
                            applicationId: application.id,
                            documents: {
                              ...docs,
                              emailAttachmentMode: "separate",
                            },
                          })
                        }>
                        Einzeldateien
                      </button>
                    </div>
                    {docs.emailAttachmentMode === "package" ? (
                      <label className="field">
                        <span>Dateiname</span>
                        <input
                          name="emailPackageFileName"
                          defaultValue={docs.emailPackageFileName}
                        />
                      </label>
                    ) : (
                      <DocumentListEditor
                        items={applicationDocumentItems}
                        onChange={updateDocumentListItem}
                      />
                    )}
                  </section>
                  {email.warnings.length ? (
                    <p className="resume-sections-warning" role="status">
                      {email.warnings.join(" ")}
                    </p>
                  ) : null}
                  <p className="word-sync-note">
                    Beim Speichern werden Email/Email.md und email.json im
                    Bewerbungsordner aktualisiert.
                  </p>
                </div>
              )}
              {tab === "lebenslauf" && (
                <>
                  <section className="page-limit-status ok">
                    <strong>
                      Lebenslauf: {resumePlan.length} / 2 A4-Seiten
                    </strong>
                    <span>
                      Einträge werden vollständig und ohne mitten im Eintrag
                      umzubrechen verteilt.
                    </span>
                  </section>
                  <button
                    className="design-panel-trigger"
                    type="button"
                    aria-expanded={designPanelOpen}
                    onClick={() => setDesignPanelOpen((current) => !current)}>
                    <Palette size={18} />
                    <span>
                      <strong>Design und Schriftart</strong>
                      <small>
                        Farben, Abstände, Schrift, Spalten und Hintergrund
                      </small>
                    </span>
                  </button>
                  <p className="design-pdf-note">Modell und Farben gelten auch für den PDF-Export.</p>
                  <section
                    className={`document-design-panel ${designPanelOpen ? "" : "collapsed"}`}>
                    <div className="design-panel-heading">
                      <div>
                        <span>Design und Schriftart</span>
                      </div>
                      <div className="design-panel-heading-actions">
                        <strong>{template.name}</strong>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label="Designpanel schließen"
                          onClick={() => setDesignPanelOpen(false)}>
                          <X size={17} />
                        </button>
                      </div>
                    </div>
                    <details className="custom-design-panel">
                      <summary><span><strong>Eigenes Design</strong><small>Eigene Vorlage erstellen, speichern und wiederverwenden</small></span></summary>
                      <div className="custom-design-library">
                        <label className="field"><span>Gespeicherte Designs</span>
                          <select aria-label="Gespeichertes eigenes Design" value={customDesignId ?? ""}
                            onChange={(event) => event.target.value ? chooseCustomDesign(event.target.value) : (setCustomDesignId(undefined), setCustomDesignName(""))}>
                            <option value="">Neues Design</option>
                            {customCvDesigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </label>
                        <label className="field"><span>Name</span><input value={customDesignName} maxLength={80} placeholder="z. B. Mein modernes Design"
                          onChange={(event) => setCustomDesignName(event.target.value)} /></label>
                        <div className="custom-design-actions">
                          <button className="button primary" type="button" disabled={!customDesignName.trim()} onClick={storeCustomDesign}>
                            {customDesignId ? <Save size={15} /> : <Plus size={15} />} {customDesignId ? "Änderungen speichern" : "Design speichern"}
                          </button>
                          {customDesignId ? <><button className="button secondary" type="button" onClick={copyCustomDesign}><Copy size={15} /> Duplizieren</button>
                            <button className="button secondary danger" type="button" onClick={deleteCustomDesign}><Trash2 size={15} /> Löschen</button></> : null}
                        </div>
                      </div>
                      <p>Gespeichert werden Layout, Farben, Schriften, Abstände, Sichtbarkeit, Reihenfolge sowie Foto- und Kopfbereich.</p>
                    </details>
                    <div className="compact-template-grid">
                      {templates.map((item) => (
                        <button
                          className={item.id === template.id ? "selected" : ""}
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setDesign((current) =>
                              selectDocumentTemplate(current, item.id),
                            )
                          }>
                          <TemplateThumbnail
                            template={item}
                            accent={
                              item.id === template.id
                                ? design.accentColor
                                : item.accent
                            }
                            secondary={
                              item.id === template.id
                                ? design.secondaryColor
                                : item.secondary
                            }
                          />
                          <span>{item.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="color-preset-row design-preset-row">
                        {colorPresets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            title={preset.name}
                            aria-label={preset.name}
                            style={
                              {
                                "--preset-accent": preset.accent,
                                "--preset-secondary": preset.secondary,
                              } as CSSProperties
                            }
                            onClick={() =>
                              setDesign((current) => ({
                                ...current,
                                accentColor: preset.accent,
                                secondaryColor: preset.secondary,
                              }))
                            }
                          />
                        ))}
                    </div>
                    <div className="color-card-grid">
                      <ColorCard label="Akzent" value={design.accentColor}
                        onChange={(color) => setDesign((current) => ({ ...current, accentColor: color }))} />
                      <ColorCard label="Fläche" value={design.secondaryColor}
                        onChange={(color) => setDesign((current) => ({ ...current, secondaryColor: color }))} />
                    </div>
                    <details className="resume-spacing-advanced design-colors-panel">
                      <summary>Farben und Dekoration</summary>
                      {([
                        ["Text", [["text", "Lesetext"], ["paragraph", "Absatztext"], ["muted", "Sekundärtext"]]],
                        ["Überschriften", [["heading", "Überschrift"], ["subheading", "Unterüberschrift"], ["sectionHeading", "Hauptabschnitt"], ["entryHeading", "Unterabschnitt"]]],
                        ["Design", [["accent", "Akzent"], ["divider", "Linien"], ["background", "Hintergrund"], ["surface", "Fläche"], ["icon", "Icon-Farbe"]]],
                      ] as const).map(([group, colors]) => <div className="design-color-group" key={group}>
                        <strong>{group}</strong>
                        <div className="color-card-grid">{colors.map(([key, label]) => <ColorCard key={key} label={label} value={resumeSpacing.colors[key]}
                          onChange={(color) => setDesign((current) => updateCvDesignField(current, "colors", key, color))} />)}</div>
                      </div>)}
                      <div className="color-card-grid">
                        <ColorCard label="Seitenspalte Abschnittstitel"
                          value={design.settings.resumeAppearance?.sidebarSectionHeadingColor ?? design.settings.resumeAppearance?.sidebarTextColor ?? (template.id === "pehlione_white_blue" ? "#ffffff" : resumeSpacing.colors.sectionHeading)}
                          onChange={(color) => updateResumeAppearance("sidebarSectionHeadingColor", color)} />
                        <ColorCard label="Abschnittslinien" value={resumeSpacing.colors.divider}
                          onChange={(color) => setDesign((current) => updateCvDesignField(current, "colors", "divider", color))} />
                      </div>
                      {design.settings.resumeAppearance?.sidebarSectionHeadingColor && <button className="design-color-reset" type="button"
                        onClick={() => updateResumeAppearance("sidebarSectionHeadingColor", undefined)}>Seitenspalte Abschnittstitel: Automatisch</button>}
                      <div className="color-card-grid">
                        {([
                          ["sidebarBackgroundColor", "Seitenspalte"],
                          ["sidebarTextColor", "Seitenspalte Text"],
                          ["mainBackgroundColor", "Hauptspalte"],
                          ["photoDecorationColor", "Fotolinien"],
                          ["contactDividerColor", "Kontaktlinie"],
                        ] as const).filter(([key]) => key !== "contactDividerColor" || template.id === "pehlione_white_blue").map(([key, label]) => <ColorCard key={key} label={label}
                          value={design.settings.resumeAppearance?.[key] ?? appearanceDefaults[key]}
                          onChange={(color) => updateResumeAppearance(key, color)} />)}
                      </div>
                      {!sidebarContrastIsReadable ? <p className="resume-sections-warning" role="status">
                        Der Kontrast zwischen Seitenspalten-Text und Hintergrund ist zu niedrig.
                      </p> : null}
                      <div className="advanced-design-grid">
                        <label className="field"><span>Abschnittslinien</span>
                          <input type="checkbox" checked={design.settings.resumeAppearance?.sectionDividerVisible !== false}
                            onChange={(event) => updateResumeAppearance("sectionDividerVisible", event.target.checked)} />
                        </label>
                        <label className="field"><span>Linienposition</span>
                          <select value={design.settings.resumeAppearance?.sectionDividerPosition ?? "template"}
                            onChange={(event) => updateResumeAppearance("sectionDividerPosition",
                              event.target.value === "template" ? undefined : event.target.value as "none" | "bottom" | "top" | "both")}>
                            <option value="template">Vorlage</option><option value="none">Keine</option>
                            <option value="bottom">Nur unten</option><option value="top">Nur oben</option><option value="both">Oben + unten</option>
                          </select>
                        </label>
                        <label className="field"><span>Linienstärke (mm)</span>
                          <input type="number" min="0.1" max="2" step="0.1"
                            placeholder="Vorlage" value={design.settings.resumeAppearance?.sectionDividerWidthMm ?? ""}
                            onChange={(event) => {
                              if (!event.target.value) { updateResumeAppearance("sectionDividerWidthMm", undefined); return; }
                              const value = Number(event.target.value);
                              if (Number.isFinite(value) && value >= 0.1 && value <= 2)
                                updateResumeAppearance("sectionDividerWidthMm", value);
                            }} />
                        </label>
                        <label className="field"><span>Fotolinien</span>
                          <input type="checkbox" checked={design.settings.resumeAppearance?.photoDecorationVisible !== false}
                            onChange={(event) => updateResumeAppearance("photoDecorationVisible", event.target.checked)} />
                        </label>
                        <label className="field"><span>Ausrichtung Abschnittstitel</span>
                          <select value={design.settings.resumeAppearance?.sectionHeadingAlignment ?? "template"}
                            onChange={(event) => updateResumeAppearance("sectionHeadingAlignment",
                              event.target.value === "template" ? undefined : event.target.value as "left" | "center" | "right")}>
                            <option value="template">Vorlage</option><option value="left">Links</option>
                            <option value="center">Mitte</option><option value="right">Rechts</option>
                          </select>
                        </label>
                        {(["sectionHeadingMarginBeforeMm", "sectionHeadingMarginAfterMm"] as const).map((key) => (
                          <label className="field" key={key}><span>{key === "sectionHeadingMarginBeforeMm" ? "Abstand davor (mm)" : "Abstand danach (mm)"}</span>
                            <input type="number" min="0" max={key === "sectionHeadingMarginBeforeMm" ? 12 : 8} step="0.5"
                              placeholder="Vorlage" value={design.settings.resumeAppearance?.[key] ?? ""}
                              onChange={(event) => updateResumeAppearance(key, event.target.value ? Number(event.target.value) : undefined)} />
                          </label>
                        ))}
                      </div>
                      {design.settings.resumeAppearance && <button className="design-color-reset" type="button"
                        onClick={() => setDesign((current) => ({ ...current, settings: { ...current.settings, resumeAppearance: undefined } }))}>
                        Farben und Dekoration: Vorlagenwerte
                      </button>}
                    </details>
                    <div className="design-option-group resume-spacing-presets">
                      <span>Lebenslauf-Abstände</span>
                      <div className="segmented-design-control" role="group" aria-label="Lebenslauf-Abstände">
                        {(["compact", "standard", "large"] as const).map((preset) => (
                          <button key={preset} type="button" className={spacingPreset === preset ? "selected" : ""}
                            aria-pressed={spacingPreset === preset}
                            onClick={() => setDesign((current) => applyResumeSpacingPreset(current, preset))}>
                            {preset === "compact" ? "Kompakt" : preset === "standard" ? "Standard" : "Groß"}
                          </button>
                        ))}
                      </div>
                      {spacingPreset === "custom" && <small>Benutzerdefinierte Abstände</small>}
                      <details className="resume-spacing-advanced">
                        <summary>Erweiterte Abstände</summary>
                        <div className="advanced-design-grid">
                          {resumeSpacingFields.map(({ key, label }) => (
                            <label className="field" key={key}>
                              <span>{label} (mm)</span>
                              <input type="number" min={cvDesignLimits[key][0]} max={cvDesignLimits[key][1]} step="0.1"
                                value={resumeSpacing.spacing[key]}
                                onChange={(event) => {
                                  if (!event.target.value) return;
                                  const entered = Number(event.target.value);
                                  if (!Number.isFinite(entered)) return;
                                  const value = Math.max(cvDesignLimits[key][0], Math.min(cvDesignLimits[key][1], entered));
                                  setDesign((current) => updateCvDesignField(current, "spacing", key, value));
                                }} />
                            </label>
                          ))}
                          <label className="field">
                            <span>Zeilenhöhe</span>
                            <input type="number" min={cvDesignLimits.lineHeight[0]} max={cvDesignLimits.lineHeight[1]} step="0.05"
                              value={resumeSpacing.typography.lineHeight}
                              onChange={(event) => {
                                if (!event.target.value) return;
                                const entered = Number(event.target.value);
                                if (!Number.isFinite(entered)) return;
                                const value = Math.max(cvDesignLimits.lineHeight[0], Math.min(cvDesignLimits.lineHeight[1], entered));
                                setDesign((current) => updateCvDesignField(current, "typography", "lineHeight", value));
                              }} />
                          </label>
                        </div>
                      </details>
                    </div>
                    <details className="resume-spacing-advanced">
                      <summary>Typografie im Detail</summary>
                      <div className="advanced-design-grid">
                        <label className="field"><span>Zeilenhöhe</span>
                          <select value={design.settings.cvOverrides?.typography?.lineHeight ?? "template"}
                            onChange={(event) => setDesign((current) => updateCvDesignField(current, "typography", "lineHeight",
                              event.target.value === "template" ? undefined : Number(event.target.value)))}>
                            <option value="template">Vorlagenwert</option>
                            {design.settings.cvOverrides?.typography?.lineHeight !== undefined &&
                              ![1.1, 1.15, 1.5].includes(design.settings.cvOverrides.typography.lineHeight) ?
                              <option value={design.settings.cvOverrides.typography.lineHeight}>Benutzerdefiniert ({design.settings.cvOverrides.typography.lineHeight.toLocaleString("de-DE")})</option> : null}
                            <option value="1.1">Eng (1,10)</option><option value="1.15">Standard (1,15)</option><option value="1.5">Weit (1,50)</option>
                          </select>
                        </label>
                        {([
                          ["bodySizePt", "Lesetext"], ["headingSizePt", "Hauptüberschrift"],
                          ["subheadingSizePt", "Unterüberschrift"], ["sectionHeadingSizePt", "Abschnittsüberschrift"],
                          ["entryHeadingSizePt", "Eintragstitel"],
                        ] as const).map(([key, label]) => <label className="field" key={key}><span>{label} (pt)</span>
                          <input type="number" step="0.25" min={cvDesignLimits[key][0]} max={cvDesignLimits[key][1]}
                            value={resumeSpacing.typography[key]} onChange={(event) => {
                              const entered = Number(event.target.value); if (!Number.isFinite(entered)) return;
                              const value = Math.max(cvDesignLimits[key][0], Math.min(cvDesignLimits[key][1], entered));
                              setDesign((current) => updateCvDesignField(current, "typography", key, value));
                            }} /></label>)}
                        {(["headingWeight", "subheadingWeight", "sectionHeadingWeight"] as const).map((key) => (
                          <label className="field" key={key}><span>{key === "headingWeight" ? "Name – Gewicht" : key === "subheadingWeight" ? "Untertitel – Gewicht" : "Abschnittstitel – Gewicht"}</span>
                            <select value={resumeSpacing.typography[key]}
                              onChange={(event) => setDesign((current) => updateCvDesignField(current, "typography", key, Number(event.target.value)))}>
                              {[300, 400, 500, 600, 700, 800, 900].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
                            </select>
                          </label>
                        ))}
                        <label className="field"><span>Abschnittstitel großschreiben</span>
                          <input type="checkbox" checked={resumeSpacing.typography.sectionHeadingUppercase}
                            onChange={(event) => setDesign((current) => updateCvDesignField(current, "typography", "sectionHeadingUppercase", event.target.checked))} />
                        </label>
                      </div>
                    </details>
                    <div className="advanced-design-grid">
                      <label className="field">
                        <span>Metadatenlayout · Berufserfahrung / Ausbildung</span>
                        <select aria-label="Metadatenlayout" value={design.settings.metadataLayout ?? "template"}
                          onChange={(event) => {
                            if (event.target.value === "template") setDesign((current) => {
                              const { metadataLayout: _layout, metadataOrder: _order, ...settings } = current.settings;
                              return { ...current, settings: settings as DocumentDesignSettings };
                            });
                            else updateDesignSetting("metadataLayout", event.target.value as "side-by-side" | "stacked");
                          }}>
                          <option value="template">Template-Standard</option>
                          <option value="side-by-side">Nebeneinander</option>
                          <option value="stacked">Untereinander</option>
                        </select>
                      </label>
                      {design.settings.metadataLayout === "side-by-side" && <label className="field">
                        <span>Reihenfolge</span>
                        <select aria-label="Metadaten-Reihenfolge" value={design.settings.metadataOrder ?? "details-first"}
                          onChange={(event) => updateDesignSetting("metadataOrder", event.target.value as "details-first" | "dates-first")}>
                          <option value="details-first">Position links · Datum rechts</option>
                          <option value="dates-first">Datum links · Position rechts</option>
                        </select>
                      </label>}
                    </div>
                    <div className="advanced-design-grid">
                      {(["strengthsColumns", "knowledgeColumns"] as const).map((key) => (
                        <label className="field" key={key}>
                          <span>{key === "strengthsColumns" ? "Stärken – Darstellung" : "Kenntnisse / Programmiersprachen – Darstellung"}</span>
                          <select aria-label={key === "strengthsColumns" ? "Stärken – Spalten" : "Kenntnisse – Spalten"}
                            value={design.settings[key] ?? "auto"}
                            onChange={(event) => updateDesignSetting(key, event.target.value === "auto" ? "auto" : Number(event.target.value) as 1 | 2 | 3 | 4)}>
                            <option value="auto">Automatisch</option>
                            {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} {count === 1 ? "Spalte" : "Spalten"}</option>)}
                          </select>
                          <small>Automatisch berücksichtigt den verfügbaren Bereich und die Textlänge. Icons: automatisch oder manuell im Inhaltseditor.</small>
                        </label>
                      ))}
                      <label className="design-range">
                        <span>
                          Seitenränder
                          <b>{design.settings.marginLevel}</b>
                        </span>
                        <input
                          aria-label="Seitenränder"
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={design.settings.marginLevel}
                          onChange={(event) =>
                            updateDesignSetting(
                              "marginLevel",
                              Number(
                                event.target.value,
                              ) as DocumentDesignSettings["marginLevel"],
                            )
                          }
                        />
                        <small>
                          <i>schmal</i>
                          <i>breit</i>
                        </small>
                      </label>
                      <label className="design-range">
                        <span>
                          Innenabstand
                          <b>{design.settings.paddingLevel}</b>
                        </span>
                        <input
                          aria-label="Innenabstand"
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={design.settings.paddingLevel}
                          onChange={(event) =>
                            updateDesignSetting(
                              "paddingLevel",
                              Number(
                                event.target.value,
                              ) as DocumentDesignSettings["paddingLevel"],
                            )
                          }
                        />
                        <small>
                          <i>kompakt</i>
                          <i>luftig</i>
                        </small>
                      </label>
                      <label className="design-range">
                        <span>
                          Abschnittsabstand
                          <b>{design.settings.sectionSpacingLevel}</b>
                        </span>
                        <input
                          aria-label="Abschnittsabstand"
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={design.settings.sectionSpacingLevel}
                          onChange={(event) =>
                            updateDesignSetting(
                              "sectionSpacingLevel",
                              Number(
                                event.target.value,
                              ) as DocumentDesignSettings["sectionSpacingLevel"],
                            )
                          }
                        />
                        <small>
                          <i>kompakt</i>
                          <i>mehr Platz</i>
                        </small>
                      </label>
                      <label className="design-range">
                        <span>
                          Zeilenhöhe
                          <b>{design.settings.lineHeightLevel}</b>
                        </span>
                        <input
                          aria-label="Zeilenhöhe"
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={design.settings.lineHeightLevel}
                          onChange={(event) =>
                            updateDesignSetting(
                              "lineHeightLevel",
                              Number(
                                event.target.value,
                              ) as DocumentDesignSettings["lineHeightLevel"],
                            )
                          }
                        />
                        <small>
                          <i>komprimiert</i>
                          <i>geräumig</i>
                        </small>
                      </label>
                    </div>
                    <div className="color-card-grid">
                      {(
                        [
                          ["textColor", "Lesetext"],
                          ["headingColor", "Überschriften"],
                          ["lineColor", "Linien"],
                          ["backgroundColor", "Hintergrund"],
                        ] as const
                      ).map(([key, label]) => <ColorCard key={key} label={label} value={design.settings[key]}
                        onChange={(color) => updateDesignSetting(key, color)} />)}
                    </div>
                    {!textContrastIsReadable ? (
                      <p className="resume-sections-warning" role="status">
                        Der Kontrast zwischen Lesetext und Hintergrund ist zu
                        niedrig. Für professionelle Lesbarkeit bitte eine
                        hellere oder dunklere Textfarbe wählen.
                      </p>
                    ) : null}
                    <div className="advanced-design-grid">
                      <label className="design-range">
                        <span>
                          Hintergrundintensität{" "}
                          <b>{design.settings.backgroundShadeLevel}</b>
                        </span>
                        <input
                          aria-label="Hintergrundintensität"
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={design.settings.backgroundShadeLevel}
                          onChange={(event) =>
                            updateDesignSetting(
                              "backgroundShadeLevel",
                              Number(
                                event.target.value,
                              ) as DocumentDesignSettings["backgroundShadeLevel"],
                            )
                          }
                        />
                        <small>
                          <i>sehr hell</i>
                          <i>dunkel</i>
                        </small>
                      </label>
                      <label className="field">
                        <span>Hintergrund anwenden auf</span>
                        <select
                          value={design.settings.backgroundScope}
                          onChange={(event) =>
                            updateDesignSetting(
                              "backgroundScope",
                              event.target
                                .value as DocumentDesignSettings["backgroundScope"],
                            )
                          }>
                          <option value="page">Komplette Seite</option>
                          <option value="sidebar">Sidebar</option>
                          <option value="header">Header</option>
                          <option value="sections">Abschnitte</option>
                        </select>
                      </label>
                    </div>
                    <label className="design-print-toggle">
                      <input
                        type="checkbox"
                        checked={design.settings.syncAcrossDocuments}
                        onChange={(event) =>
                          updateDesignSetting(
                            "syncAcrossDocuments",
                            event.target.checked,
                          )
                        }
                      />
                      <span>Auf alle Bewerbungsunterlagen anwenden</span>
                    </label>
                    <div className="design-option-group">
                      <span>Lebenslauf-Layout</span>
                      <div className="segmented-design-control" role="group" aria-label="Lebenslauf-Layout">
                        {([undefined, "single", "two-column"] as const).map((mode) => (
                          <button key={mode ?? "template"} type="button"
                            className={(mode === undefined ? !resumeLayout.overridden : design.settings.resumePresentation?.layoutMode === mode) ? "selected" : ""}
                            aria-pressed={mode === undefined ? !resumeLayout.overridden : design.settings.resumePresentation?.layoutMode === mode}
                            onClick={() => updateResumeLayout("layoutMode", mode)}>
                            {mode === undefined ? "Vorlage" : mode === "single" ? "Einspaltig" : "Zweispaltig"}
                          </button>
                        ))}
                      </div>
                      {resumeLayout.mode === "two-column" ? (
                        <div className="advanced-design-grid">
                          <label className="field">
                            <span>Seitenspalte</span>
                            <select aria-label="Seitenspalte" value={resumeLayout.sidebarSide}
                              onChange={(event) => updateResumeLayout("sidebarSide", event.target.value as "left" | "right")}>
                              <option value="left">Links</option>
                              <option value="right">Rechts</option>
                            </select>
                          </label>
                          <label className="design-range">
                            <span>Spaltenverhältnis <b>{resumeLayout.sidebarWidthPercent}% / {100 - resumeLayout.sidebarWidthPercent}%</b></span>
                            <input aria-label="Spaltenverhältnis" type="range" min="20" max="45" step="1"
                              value={resumeLayout.sidebarWidthPercent}
                              onChange={(event) => updateResumeLayout("sidebarWidthPercent", Number(event.target.value))} />
                            <small><i>20% Seitenspalte</i><i>45% Seitenspalte</i></small>
                            {design.settings.resumePresentation?.sidebarWidthPercent !== undefined ? <button className="design-color-reset" type="button"
                              onClick={() => updateResumeLayout("sidebarWidthPercent", undefined)}>Vorlagenverhältnis verwenden</button> : null}
                          </label>
                        </div>
                      ) : null}
                      <div className="advanced-design-grid">
                        <label className="field"><span>Foto-Layout</span><select
                          value={design.settings.resumeAppearance?.photoLayout ?? "template"}
                          onChange={(event) => updateResumeAppearance("photoLayout", event.target.value as NonNullable<DocumentDesignSettings["resumeAppearance"]>["photoLayout"])}>
                          <option value="template">Vorlage</option><option value="circle">Rund</option><option value="rounded">Abgerundet</option><option value="square">Eckig</option><option value="hidden">Ausblenden</option>
                        </select></label>
                        <label className="field"><span>Kopfbereich</span><select
                          value={design.settings.resumeAppearance?.headerLayout ?? "template"}
                          onChange={(event) => updateResumeAppearance("headerLayout", event.target.value as NonNullable<DocumentDesignSettings["resumeAppearance"]>["headerLayout"])}>
                          <option value="template">Vorlage</option><option value="left">Linksbündig</option><option value="center">Zentriert</option><option value="split">Geteilt</option>
                        </select></label>
                      </div>
                    </div>
                    <div className="design-option-group">
                      <span>Schriftgröße</span>
                      <div className="segmented-design-control">
                        {(["small", "medium", "large"] as const).map((size) => (
                          <button
                            className={
                              design.settings.fontSize === size
                                ? "selected"
                                : ""
                            }
                            key={size}
                            type="button"
                            onClick={() =>
                              updateDesignSetting("fontSize", size)
                            }>
                            {size === "small"
                              ? "Small"
                              : size === "medium"
                                ? "Medium"
                                : "Large"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="design-font-grid">
                      <label className="field">
                        <span>Textschrift</span>
                        <select
                          value={design.settings.fontId}
                          onChange={(event) =>
                            updateDesignSetting(
                              "fontId",
                              event.target
                                .value as DocumentDesignSettings["fontId"],
                            )
                          }>
                          {documentFonts.map((font) => (
                            <option key={font.id} value={font.id}>
                              {font.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Überschrift</span>
                        <select
                          value={design.settings.headingFontId}
                          onChange={(event) =>
                            updateDesignSetting(
                              "headingFontId",
                              event.target
                                .value as DocumentDesignSettings["headingFontId"],
                            )
                          }>
                          {documentFonts.map((font) => (
                            <option key={font.id} value={font.id}>
                              {font.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="design-option-group">
                      <span>Ausgabemodus</span>
                      <div className="segmented-design-control">
                        {(["visual", "ats"] as const).map((mode) => (
                          <button
                            className={
                              design.settings.resumeOutputMode === mode
                                ? "selected"
                                : ""
                            }
                            key={mode}
                            type="button"
                            onClick={() =>
                              updateDesignSetting("resumeOutputMode", mode)
                            }>
                            {mode === "visual" ? "Visual" : "ATS optimiert"}
                          </button>
                        ))}
                      </div>
                      {isAtsMode ? (
                        <p className="design-ats-background-note">
                          ATS-Modus nutzt automatisch ein lineares, einspaltiges
                          Layout mit reduzierter Visualisierung.
                        </p>
                      ) : null}
                    </div>
                    {template.atsInfo ? (
                      <p className="design-ats-background-note">
                        {template.atsInfo}
                      </p>
                    ) : null}
                    <button
                      className="button secondary design-reset-button"
                      type="button"
                      onClick={resetAllDesignSettings}>
                      Auf Standard zurücksetzen
                    </button>
                  </section>
                  {profile ? (
                    <ResumeSectionsPanel
                      key={`${application.id}:${profile.id}:${template.id}:${resumeEditorRevision}`}
                      profile={editorProfile ?? profile}
                      singlePageExceeded={template.id === "kompakt" && resumePlan.length > 1}
                      templateId={template.id}
                      layoutMode={resumeLayout.mode}
                      closingPlacement={design.settings.resumePresentation?.closing?.placement}
                      closingAlignment={design.settings.resumePresentation?.closing?.alignment ?? (template.id.startsWith("pehlione_") ? "distributed" : "left")}
                      onClosingLayoutChange={updateClosingLayout}
                      summaryValue={docs.resumeProfile}
                      onSummaryChange={(summary) => setDocumentPreview({ applicationId: application.id,
                        documents: { ...docs, resumeProfile: summary } })}
                      onPickMedia={(kind) => void pickProfileMedia(kind)}
                      onRemoveMedia={(kind) => void removeProfileMedia(kind)}
                      onSave={saveResumeSections}
                      onPreview={handleResumeSectionPreview}
                    />
                  ) : null}
                  <section className="match-analysis">
                    <header>
                      <div>
                        <span>Stellenanzeigen-Match</span>
                        <strong>{keywordMatch.score}%</strong>
                      </div>
                      <i>
                        <b style={{ width: `${keywordMatch.score}%` }} />
                      </i>
                    </header>
                    <div>
                      <p>Gefundene Kenntnisse</p>
                      <div className="match-chips positive">
                        {keywordMatch.matchedSkills.length ? (
                          keywordMatch.matchedSkills.map((skill) => (
                            <span key={skill}>{skill}</span>
                          ))
                        ) : (
                          <small>Noch keine Profil-Kenntnis gefunden.</small>
                        )}
                      </div>
                    </div>
                    <div>
                      <p>Begriffe aus der Stellenanzeige prüfen</p>
                      <div className="match-chips suggestions">
                        {keywordMatch.suggestions.length ? (
                          keywordMatch.suggestions.map((keyword) => (
                            <span key={keyword}>{keyword}</span>
                          ))
                        ) : (
                          <small>
                            Stellenanzeigentext für Vorschläge ergänzen.
                          </small>
                        )}
                      </div>
                    </div>
                    <small>
                      Vorschläge werden niemals automatisch in Ihren Lebenslauf
                      übernommen.
                    </small>
                  </section>
                </>
              )}
              <div className="editor-note">
                <UserRound size={17} />
                <p>
                  Berufserfahrung, Ausbildung und Kenntnisse kommen aus dem
                  ausgewählten Profil. Eigene Fähigkeiten werden niemals
                  automatisch erfunden.
                </p>
              </div>
              <button className="button primary full-button" type="submit">
                <Save size={17} />{" "}
                {tab === "anschreiben"
                  ? "Texte speichern & Word aktualisieren"
                  : "Texte speichern"}
              </button>
            </form>
          </aside>
        }
        secondary={
          <main
            className="paper-stage"
            ref={paperStageRef}
            style={
              {
                "--document-preview-scale": previewScale,
              } as CSSProperties
            }>
            {tab === "deckblatt" && (
              <div
                className={`document-paper document-deckblatt layout-${template.layout} ${designClassName}`}
                style={paperStyle}>
                <DocumentBackgroundLayer
                  backgroundId={design.settings.backgroundId}
                  atsMode={isAtsMode}
                />
                <div className="deckblatt-preview">
                  <i className="paper-rule" />
                  <section className="deckblatt-preview__hero">
                    <div>
                      <h1>{createCoverSubject(application.job.title)}</h1>
                      <p className="paper-muted">
                        bei {application.company.name}
                      </p>
                      {application.company.city ? (
                        <p className="deckblatt-preview__location">
                          Standort: {application.company.city}
                        </p>
                      ) : null}
                      <p className="deckblatt-preview__location">
                        {formatApplicationDate(application)}
                      </p>
                    </div>
                    {photoSource ? (
                      <img
                        className="deckblatt-preview__photo"
                        src={photoSource}
                        alt={`Bewerbungsfoto von ${name}`}
                      />
                    ) : null}
                  </section>
                  <section className="deckblatt-preview__identity">
                    <h2>{name}</h2>
                    {coverSheetProfessionalTitle ? (
                      <p>{coverSheetProfessionalTitle}</p>
                    ) : null}
                    {docs.deckblattStatement || profile?.summary ? (
                      <p className="deckblatt-preview__statement">
                        {docs.deckblattStatement || profile?.summary}
                      </p>
                    ) : null}
                  </section>
                  <section className="deckblatt-preview__details">
                    <div>
                      <h3>Bewerbungsunterlagen</h3>
                      <ul>
                        {deckblattDocuments.map((document) => (
                          <li key={document}>{document}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      {deckblattCompetencies.length ? (
                        <>
                          <h3>Kernkompetenzen</h3>
                          <p className="deckblatt-preview__competencies">
                            {deckblattCompetencies.join(" · ")}
                          </p>
                        </>
                      ) : null}
                      {deckblattContacts.length ? (
                        <>
                          <h3>Kontakt</h3>
                          <ul>
                            {deckblattContacts.map((contact) => (
                              <li key={contact.label}>
                                <strong>{contact.label}</strong>{" "}
                                {contact.href ? (
                                  <a href={contact.href}>{contact.value}</a>
                                ) : (
                                  contact.value
                                )}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  </section>
                </div>
              </div>
            )}
            {tab === "anschreiben" && (
              <div
                className={`document-paper document-anschreiben letter-${letterStatus.density} letter-gap-${docs.coverSubjectGapReduction} layout-${template.layout} ${designClassName}`}
                data-resume-template={template.id}
                ref={letterPaperRef}
                style={paperStyle}>
                <DocumentBackgroundLayer
                  backgroundId={design.settings.backgroundId}
                  atsMode={isAtsMode}
                />
                <div className="letter-preview">
                  <div className="letter-header">
                    <p className="sender-line">
                      <span className="sender-name">{coverSenderName}</span>
                      <span className="sender-title">{coverSenderTitle}</span>
                      <span className="sender-contact">
                        {coverSenderContact}
                      </span>
                    </p>
                  </div>
                  <i className="paper-rule letter-rule" />
                  <address>
                    {recipientLines.map((line, index) => (
                      <span key={`${index}-${line}`}>
                        {line}
                        {index < recipientLines.length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </address>
                  <p className="paper-date">
                    {profile?.city ? `${profile.city}, ` : ""}
                    den {formatApplicationDateLong(application)}
                  </p>
                  <h3>
                    {createCoverSubject(
                      application.job.title,
                      docs.coverSubject,
                    )}
                    {application.job.reference &&
                    !(docs.coverSubject || "").includes(
                      application.job.reference,
                    )
                      ? ` - Referenz ${application.job.reference}`
                      : ""}
                  </h3>
                  <p className="letter-salutation">{coverGreeting}</p>
                  <p className="letter-body">{docs.coverIntroduction}</p>
                  <p className="letter-body">
                    {getCoverLetterMainBody(docs) ||
                      profile?.summary ||
                      "Hauptteil ergänzen …"}
                  </p>
                  {docs.coverExtraParagraph ? (
                    <p className="letter-body">{docs.coverExtraParagraph}</p>
                  ) : null}
                  <p className="letter-body">
                    {docs.coverCompanyFit || "Unternehmensbezug ergänzen …"}
                  </p>
                  <p className="letter-body letter-closing">
                    {docs.coverClosing}
                  </p>
                  <p className="letter-signature">
                    <span>Mit freundlichen Grüßen</span>
                    {signatureSource ? (
                      <img
                        className="signature-image"
                        src={signatureSource}
                        alt={`Unterschrift von ${name}`}
                      />
                    ) : null}
                    <span className="signature-name">{name}</span>
                  </p>
                  {docs.showCoverLetterAttachments ? (
                    <div className="letter-attachments">
                      <strong>Anlagen</strong>
                      {coverLetterAttachments.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            {tab === "email" && (
              <div className="document-paper document-email" style={paperStyle}>
                <div className="email-preview">
                  <header>
                    <Mail size={30} />
                    <div>
                      <p className="eyebrow">Bewerbungs-E-Mail</p>
                      <h2>{email.subject}</h2>
                    </div>
                  </header>
                  <dl>
                    <div>
                      <dt>Datum</dt>
                      <dd>{email.applicationDate}</dd>
                    </div>
                    <div>
                      <dt>Firma</dt>
                      <dd>{email.companyName}</dd>
                    </div>
                    <div>
                      <dt>Stelle</dt>
                      <dd>{email.jobTitle}</dd>
                    </div>
                    <div>
                      <dt>Empfänger</dt>
                      <dd>{email.recipientName || "Nicht angegeben"}</dd>
                    </div>
                    <div>
                      <dt>E-Mail</dt>
                      <dd>{email.recipientEmail || "Nicht angegeben"}</dd>
                    </div>
                    <div>
                      <dt>Absender</dt>
                      <dd>{email.senderName || "Nicht angegeben"}</dd>
                    </div>
                  </dl>
                  <section className="email-message-preview">
                    <p>{email.salutation}</p>

                    <p>{email.body}</p>

                    <p>{email.greeting}</p>

                    <p>{email.senderName || "Absender im Profil ergänzen"}</p>
                    {email.attachments.length > 0 && (
                      <div className="email-attachments-preview">
                        <strong>Anlagen</strong>

                        <ul>
                          {email.attachments.map((attachment) => (
                            <li key={attachment}>{attachment}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}
            {tab === "lebenslauf" &&
              ((renderProfile) =>
                resumePlan.map((plan) => (
                  <div
                    className={`document-paper document-lebenslauf layout-${template.layout} ${designClassName}`}
                    key={plan.pageNumber}
                    style={paperStyle}>
                    <style>
                      {getResumeIdentityVisibilityCss(
                        renderProfile?.resumeSemanticSections,
                      )}
                    </style>
                    <ManagedResumePreview
                      designSettings={design.settings}
                      resolvedCv={resolvedCv}
                      profile={renderProfile}
                      templateId={template.id}
                      pageNumber={plan.pageNumber}
                      totalPages={resumePlan.length}>
                      <DocumentBackgroundLayer
                        backgroundId={design.settings.backgroundId}
                        atsMode={isAtsMode}
                      />
                      {template.id === "stilvoll" ? (
                        <StilvollResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          backgroundId={design.settings.backgroundId}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "kompakt" ? (
                        <KompaktResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          backgroundId={design.settings.backgroundId}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "einspaltig" ? (
                        <EinspaltigResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          backgroundId={design.settings.backgroundId}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "klassisch" ? (
                        <KlassischResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          backgroundId={design.settings.backgroundId}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "ivy-league" ? (
                        <IvyLeagueResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          backgroundId={design.settings.backgroundId}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "kreativ" ? (
                        <KreativResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "zeitgenoessisch" ? (
                        <ZeitgenoessischResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "zweispaltig" ? (
                        <ZweispaltigResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "gepflegt" ? (
                        <GepflegtResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "elegant" ? (
                        <ElegantResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "tabellarisch" ? (
                        <TabellarischResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "pehlione_white_blue" ||
                        template.id === "pehlione_white" ? (
                        <PehlioneResume
                          templateId={
                            template.id as
                              | "pehlione_white_blue"
                              | "pehlione_white"
                          }
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          resumeProfile={pehlioneResumeProfile}
                          sections={sections}
                        />
                      ) : template.id === "modern" ? (
                        <ModernResume
                          profile={renderProfile}
                          name={name}
                          atsMode={isAtsMode}
                          plan={plan}
                          totalPages={resumePlan.length}
                          accentColor={design.accentColor}
                          secondaryColor={design.secondaryColor}
                          photoSource={getProfileMediaSource(
                            renderProfile?.photoPath,
                          )}
                          resumeProfile={docs.resumeProfile}
                          sections={sections}
                        />
                      ) : (
                        <ResumePreviewPage
                          application={application}
                          atsMode={isAtsMode}
                          documents={docs}
                          name={name}
                          plan={plan}
                          profile={renderProfile}
                          sections={sections}
                          totalPages={resumePlan.length}
                        />
                      )}
                    </ManagedResumePreview>
                  </div>
                )))(resumeRenderProfile)}
          </main>
        }
      />
    </div>
  );
}

function DocumentMediaCard({
  kind,
  label,
  source,
  disabled,
  onPick,
  onRemove,
}: {
  kind: ProfileMediaKind;
  label: string;
  source: string;
  disabled: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const Icon = kind === "photo" ? ImagePlus : PenLine;
  return (
    <article className={`document-media-card media-${kind}`}>
      <button
        className="document-media-preview"
        type="button"
        disabled={disabled}
        aria-label={`${label} ${source ? "ersetzen" : "auswählen"}`}
        onClick={onPick}>
        {source ? (
          <img src={source} alt={`${label} Vorschau`} />
        ) : (
          <Icon size={25} />
        )}
      </button>
      <div>
        <strong>{label}</strong>
        <small>
          {disabled
            ? "Zuerst ein Profil auswählen"
            : source
              ? "Ausgewählt · anklicken zum Ersetzen"
              : "Neu hinzufügen"}
        </small>
      </div>
      {source ? (
        <button
          className="icon-button danger"
          type="button"
          aria-label={`${label} entfernen`}
          onClick={onRemove}>
          <X size={14} />
        </button>
      ) : null}
    </article>
  );
}
