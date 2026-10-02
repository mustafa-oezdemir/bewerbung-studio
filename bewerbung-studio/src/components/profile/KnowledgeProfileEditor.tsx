import { Plus, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { KnowledgeSectionEditor } from "../knowledge/KnowledgeSectionEditor";
import { LanguageLevelEditor } from "../languages/LanguageLevelEditor";
import { CertificateListEditor } from "./EntryListEditor";
import { ResumeSectionTitleEditor } from "../resume/ResumeSectionTitleEditor";
import { OrderControls } from "./OrderControls";
import { moveListItem } from "../../shared/listOrder";
import { getResumeSectionTitle, setResumeSectionTitle } from "../../features/resume-sections/resume-sections";
import { ensureKnowledgeSection } from "../../features/knowledge/knowledge.service";
import { knowledgeLists } from "../../shared/resumeKnowledgeRange";
import type { ApplicantProfile, ResumeSpecialSectionKind } from "../../shared/schema";

type Special = ApplicantProfile["specialSections"][number];
type SpecialEntry = Special["entries"][number];
const newEntry = (): SpecialEntry => ({
  id: crypto.randomUUID(), title: "", subtitle: "", from: "", to: "", date: "",
  location: "", url: "", description: "", bullets: [],
});

/** One profile experience for the existing knowledge, language, certificate and qualification sources. */
export function KnowledgeProfileEditor({ profile, onChange, onCopyCategory }: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
  onCopyCategory?: (categoryId: string) => void;
}) {
  const knowledge = ensureKnowledgeSection(profile.knowledgeSection, profile.skills);
  const visibleCount = knowledge.isVisible
    ? knowledgeLists(knowledge).reduce((total, list) => total + list.items.length, 0) : 0;
  const setSpecial = (kind: ResumeSpecialSectionKind, update: (section: Special) => Special) =>
    onChange((current) => ({
      ...current,
      specialSections: current.specialSections.map((section) => section.kind === kind ? update(section) : section),
    }));
  const addSpecial = (kind: ResumeSpecialSectionKind, title: string) =>
    onChange((current) => {
      const exists = current.specialSections.find((section) => section.kind === kind);
      return {
        ...current,
        specialSections: exists
          ? current.specialSections.map((section) => section.id === exists.id
              ? { ...section, entries: [...section.entries, newEntry()] } : section)
          : [...current.specialSections, {
              id: crypto.randomUUID(), kind, title, isVisible: true, contentType: "list" as const,
              entries: [newEntry()],
            }],
      };
    });
  const qualifications = (kind: ResumeSpecialSectionKind, title: string, addLabel: string) => {
    const section = profile.specialSections.find((entry) => entry.kind === kind);
    return <div className="knowledge-qualification-list">
      {section ? <label className="checkbox-field"><input type="checkbox" checked={section.isVisible}
        onChange={(event) => setSpecial(kind, (item) => ({ ...item, isVisible: event.target.checked }))} />
        <span>Im Lebenslauf anzeigen</span></label> : null}
      {section?.entries.map((entry, index) => <div className="entry-list-editor__row" key={entry.id}>
        <OrderControls index={index} length={section.entries.length} label={entry.title || `${title} ${index + 1}`}
          onMove={(target) => setSpecial(kind, (item) => ({ ...item, entries: moveListItem(item.entries, index, target) }))} />
        <label className="field"><span>{title}</span><input value={entry.title} placeholder={kind === "drivingLicenses" ? "z. B. Klasse B" : "Beruflich relevante Qualifikation"}
          onChange={(event) => setSpecial(kind, (item) => ({ ...item,
            entries: item.entries.map((candidate) => candidate.id === entry.id ? { ...candidate, title: event.target.value } : candidate),
          }))} /></label>
        <button type="button" className="icon-button danger" aria-label={`${title} löschen`}
          onClick={() => setSpecial(kind, (item) => ({ ...item, entries: item.entries.filter((candidate) => candidate.id !== entry.id) }))}>
          <Trash2 size={15} /></button>
      </div>)}
      {!section?.entries.length ? <p className="entry-list-editor__empty">Noch kein Eintrag vorhanden.</p> : null}
      <button type="button" className="button secondary small-button" onClick={() => addSpecial(kind, title)}>
        <Plus size={15} /> {addLabel}
      </button>
    </div>;
  };
  return <div className="knowledge-profile-editor">
    <p className="field-hint">Nur Kenntnisse aufnehmen, die für die gewünschte Stelle relevant oder beruflich aussagekräftig sind. Etwa 5–7 besonders relevante Kenntnisse sind ein guter Fokus, keine Grenze.</p>
    <details className="knowledge-profile-group" open>
      <summary>Fach- &amp; IT-Kenntnisse <small>{visibleCount} sichtbar</small></summary>
      <KnowledgeSectionEditor value={{ ...knowledge, title: getResumeSectionTitle(profile, "knowledge") }}
        onChange={(knowledgeSection) => onChange((current) => setResumeSectionTitle(
          { ...current, knowledgeSection }, "knowledge", knowledgeSection.title))}
        onCopyCategory={onCopyCategory} />
    </details>
    <details className="knowledge-profile-group">
      <summary>Sprachkenntnisse <small>{profile.languages.filter(Boolean).length}</small></summary>
      <ResumeSectionTitleEditor profile={profile} section="languages" onChange={onChange} />
      <LanguageLevelEditor values={profile.languages} onChange={(languages) => onChange((current) => ({ ...current, languages }))} />
    </details>
    <details className="knowledge-profile-group">
      <summary>Zertifikate &amp; Weiterbildungen <small>{profile.certifications.filter(Boolean).length}</small></summary>
      <ResumeSectionTitleEditor profile={profile} section="certifications" onChange={onChange} />
      <CertificateListEditor values={profile.certifications} onChange={(certifications) => onChange((current) => ({ ...current, certifications }))} />
    </details>
    <details className="knowledge-profile-group">
      <summary>Weitere Zusatzqualifikationen</summary>
      <h4>Führerschein</h4>
      <p className="field-hint">Nur vorhandene Führerscheinklassen angeben.</p>
      {qualifications("drivingLicenses", "Führerschein", "Führerscheinklasse hinzufügen")}
      <h4>Weitere berufliche Nachweise</h4>
      {qualifications("additional", "Zusatzqualifikation", "Zusatzqualifikation hinzufügen")}
    </details>
  </div>;
}
