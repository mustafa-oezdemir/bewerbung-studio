import { Plus, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import { OrderControls } from "./OrderControls";

type Section = ApplicantProfile["specialSections"][number];
type Entry = Section["entries"][number];

const newEntry = (): Entry => ({
  id: crypto.randomUUID(), title: "", subtitle: "", from: "", to: "", date: "",
  location: "", url: "", description: "", bullets: [], technologies: [],
});

/** The first interests section is edited here; other legacy sections stay untouched. */
export function InterestsEditor({ profile, onChange }: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
}) {
  const sections = profile.specialSections.filter(section => section.kind === "interests");
  const section = sections[0];
  const semantic = profile.resumeSemanticSections.find(item => item.semanticType === "interests");
  const title = section?.title || semantic?.customTitle || "Interessen und Hobbys";
  const updateSection = (change: (current: Section) => Section) => onChange(current => ({
    ...current,
    specialSections: current.specialSections.map(item => item.id === section?.id ? change(item) : item),
  }));
  const updateEntry = (id: string, change: Partial<Entry>) => updateSection(current => ({
    ...current, entries: current.entries.map(entry => entry.id === id ? { ...entry, ...change } : entry),
  }));
  const addEntry = () => onChange(current => {
    const first = current.specialSections.find(item => item.kind === "interests");
    const entries = first ? current.specialSections.map(item => item.id === first.id
      ? { ...item, entries: [...item.entries, newEntry()] } : item)
      : [...current.specialSections, {
        id: crypto.randomUUID(), kind: "interests" as const,
        title: current.resumeSemanticSections.find(item => item.semanticType === "interests")?.customTitle || "Interessen und Hobbys",
        isVisible: true, contentType: "list" as const, entries: [newEntry()],
      }];
    return { ...current, specialSections: entries,
      resumeSemanticSections: current.resumeSemanticSections.map(item => item.semanticType === "interests"
        ? { ...item, visible: first ? first.isVisible : true, enabled: first ? first.isVisible : true } : item) };
  });
  const setVisibility = (visible: boolean) => onChange(current => ({
    ...current,
    specialSections: current.specialSections.map(item => item.id === section?.id ? { ...item, isVisible: visible } : item),
    resumeSemanticSections: current.resumeSemanticSections.map(item => item.semanticType === "interests"
      ? { ...item, visible, enabled: visible } : item),
  }));
  const setTitle = (value: string) => onChange(current => ({
    ...current,
    specialSections: current.specialSections.map(item => item.id === section?.id ? { ...item, title: value } : item),
    resumeSemanticSections: current.resumeSemanticSections.map(item => item.semanticType === "interests"
      ? { ...item, customTitle: value === "Interessen und Hobbys" ? "" : value } : item),
  }));
  return <div className="interests-editor">
    <label className="checkbox-field"><input type="checkbox" checked={section?.isVisible ?? semantic?.visible ?? false}
      onChange={event => setVisibility(event.target.checked)} /><span>Im Lebenslauf anzeigen</span></label>
    <label className="field"><span>Überschrift im Lebenslauf</span>
      <input value={title} list="interest-title-suggestions" onChange={event => setTitle(event.target.value)} />
      <datalist id="interest-title-suggestions"><option value="Interessen und Hobbys" /><option value="Freizeitaktivitäten" />
        <option value="Persönliche Interessen" /><option value="Meine Interessen" /><option value="Interessen und Engagement" /></datalist>
    </label>
    {sections.length > 1 && <p className="field-hint">Weitere ältere Interessen-Bereiche bleiben unter „Besondere Lebenslauf-Bereiche“ erhalten.</p>}
    {section?.entries.length ? <p className="field-hint">{section.entries.length} Interessen erfasst · 3–4 passende Einträge sind oft ausreichend.</p>
      : <p className="field-hint">Noch keine Interessen oder Hobbys erfasst.</p>}
    <p className="field-hint">Wählen Sie Interessen, die Sie tatsächlich ausüben und die Ihr Profil ergänzen. Ehrenamt können Sie in einem eigenen Bereich beschreiben.</p>
    <div className="special-entry-list">{section?.entries.map((entry, index) => <details className="special-entry-card" key={entry.id}>
      <summary>{entry.title.trim() || `Interesse ${index + 1}`}{entry.description.trim() ? ` · ${entry.description.trim()}` : ""}</summary>
      <OrderControls index={index} length={section.entries.length} label={entry.title || `Interesse ${index + 1}`}
        onMove={target => updateSection(current => {
          const entries = [...current.entries];
          const [moved] = entries.splice(index, 1);
          entries.splice(target, 0, moved);
          return { ...current, entries };
        })} />
      <div className="form-grid">
        <label className="field"><span>Interesse / Hobby</span><input value={entry.title}
          onChange={event => updateEntry(entry.id, { title: event.target.value })} /></label>
        <label className="field"><span>Kurze Beschreibung</span><input value={entry.description}
          onChange={event => updateEntry(entry.id, { description: event.target.value })} /></label>
      </div>
      <button className="button tertiary small-button" type="button" onClick={() => updateSection(current => ({
        ...current, entries: current.entries.filter(item => item.id !== entry.id),
      }))}><Trash2 size={15} /> Eintrag löschen</button>
    </details>)}</div>
    <button className="button secondary small-button" type="button" onClick={addEntry}><Plus size={15} /> Interesse hinzufügen</button>
  </div>;
}
