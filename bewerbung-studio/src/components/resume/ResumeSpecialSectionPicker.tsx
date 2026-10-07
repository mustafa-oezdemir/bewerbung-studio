import {
  BookOpen,
  BriefcaseBusiness,
  Car,
  FolderKanban,
  Globe,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  ListPlus,
  Plus,
  Sparkles,
  SquarePen,
  Trophy,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import type { ResumeSpecialSectionKind } from "../../shared/schema";
import {
  canAddResumeSpecialSection,
  resumeSpecialSectionCatalog,
  type ResumeSpecialSection,
} from "../../shared/resumeSpecialSectionCatalog";

const icons: Record<ResumeSpecialSectionKind, LucideIcon> = {
  projects: FolderKanban,
  internships: BriefcaseBusiness,
  trainings: GraduationCap,
  internationalExperience: Globe,
  scholarships: HandCoins,
  awards: Trophy,
  publications: BookOpen,
  volunteer: HeartHandshake,
  interests: Sparkles,
  drivingLicenses: Car,
  additional: ListPlus,
  references: UserCheck,
  custom: SquarePen,
};

type Props = {
  /** The sections already in the profile: a kind that exists only once cannot be chosen again. */
  sections: readonly Pick<ResumeSpecialSection, "kind">[];
  onAdd: (kind: ResumeSpecialSectionKind) => void;
  title?: string;
};

/** Choose one of the catalogue's Lebenslauf-Bereiche, then add it: the same picker in Profil and Lebenslauf. */
export function ResumeSpecialSectionPicker({ sections, onAdd, title = "Bereich auswählen" }: Props) {
  const id = useId();
  const [selected, setSelected] = useState<ResumeSpecialSectionKind | null>(null);
  const chosen = resumeSpecialSectionCatalog.find(
    (option) => option.kind === selected && canAddResumeSpecialSection(option.kind, sections),
  );
  return (
    <section className="special-section-picker" aria-labelledby={`${id}-title`}>
      <div className="special-section-picker-head">
        <strong id={`${id}-title`}>{title}</strong>
        <small id={`${id}-hint`}>Wählen Sie einen passenden Bereich für Ihren Lebenslauf.</small>
      </div>
      <div className="special-section-picker-grid" role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`}>
        {resumeSpecialSectionCatalog.map((option) => {
          const Icon = icons[option.kind];
          const available = canAddResumeSpecialSection(option.kind, sections);
          const pressed = chosen?.kind === option.kind;
          return (
            <button
              key={option.kind}
              type="button"
              className="special-section-option"
              data-kind={option.kind}
              title={option.description}
              aria-pressed={pressed}
              disabled={!available}
              onClick={() => setSelected(pressed ? null : option.kind)}>
              <Icon size={15} aria-hidden="true" />
              <span>{option.label}</span>
              {!available && <small>Bereits hinzugefügt</small>}
            </button>
          );
        })}
      </div>
      <div className="special-section-picker-actions">
        <small aria-live="polite">
          {chosen ? `${chosen.label}: ${chosen.description}` : "Noch kein Bereich ausgewählt."}
        </small>
        <button
          type="button"
          className="button secondary small-button"
          disabled={!chosen}
          onClick={() => {
            if (!chosen) return;
            onAdd(chosen.kind);
            setSelected(null);
          }}>
          <Plus size={15} /> Bereich hinzufügen
        </button>
      </div>
    </section>
  );
}
