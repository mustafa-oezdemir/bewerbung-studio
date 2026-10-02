import { Check, Circle, Lightbulb } from "lucide-react";
import { useId, type Dispatch, type SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import {
  getSummaryGuidance,
  isResumeSummaryVisible,
  setResumeSummaryVisible,
  summaryRecommendation,
} from "../../shared/resumeSummary";
import { SummaryCounter } from "../resume/SummaryGuidance";
import { SectionTitleSelect } from "./SectionTitleSelect";

export const summaryTitleOptions = ["Kurzprofil", "Über mich", "Persönliches Profil"] as const;

/** What a Kurzprofil can hold, and the questions that structure it: a guide, nothing is filled in for the user. */
export const summaryContentHints = [
  "Beruflicher Schwerpunkt",
  "Relevante Erfahrung",
  "Kernkompetenzen",
  "Besondere Erfolge",
  "Berufliches Ziel",
] as const;
export const summaryWritingQuestions = [
  "Wer bin ich?",
  "Was kann ich?",
  "Welche Erfahrung bringe ich mit?",
  "Welchen Schwerpunkt suche ich?",
] as const;

/**
 * Shared Kurzprofil editor for Profil and Lebenslauf. Both edit the same `ApplicantProfile.summary`.
 */
export function SummaryEditor({
  profile,
  onChange,
}: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
}) {
  const id = useId();
  const visible = isResumeSummaryVisible(profile);
  const guidance = getSummaryGuidance(profile.summary);
  const checks = [
    { done: guidance.words > 0, label: "Text vorhanden" },
    { done: guidance.sentenceRange === "ok", label: `${summaryRecommendation.sentences.min}–${summaryRecommendation.sentences.max} Sätze` },
    { done: guidance.wordRange === "ok", label: `ca. ${summaryRecommendation.words.min}–${summaryRecommendation.words.max} Wörter` },
  ];

  return (
    <div className="summary-editor">
      <SectionTitleSelect
        profile={profile}
        section="summary"
        options={summaryTitleOptions}
        ariaLabel="Kurzprofil Überschrift"
        onChange={onChange}
      />

      <div className="field">
        <label htmlFor={`${id}-text`}>Text</label>
        <textarea
          id={`${id}-text`}
          rows={7}
          value={profile.summary}
          aria-describedby={`${id}-count`}
          placeholder="Beschreiben Sie in wenigen Sätzen Ihren Schwerpunkt, Ihre Erfahrung und Ihre Stärken."
          onChange={(event) => onChange((current) => ({ ...current, summary: event.target.value }))}
        />
        <div id={`${id}-count`}>
          <SummaryCounter value={profile.summary} />
        </div>
        {guidance.words === 0 ? <small className="field-hint">Noch kein Kurzprofil hinterlegt.</small> : null}
      </div>

      <ul className="summary-checks" aria-label="Umfang">
        {checks.map((check) => (
          <li key={check.label} className={check.done ? "is-done" : undefined}>
            {check.done ? <Check size={13} aria-hidden="true" /> : <Circle size={13} aria-hidden="true" />} {check.label}
          </li>
        ))}
      </ul>

      <aside className="summary-guide" aria-label="Hinweise zum Kurzprofil">
        <strong>Inhalt</strong>
        <ul>
          {summaryContentHints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
        <details>
          <summary>Schreibhilfe</summary>
          <ol>
            {summaryWritingQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
          <small>Ob in der Ich-Form oder ohne Pronomen – beides ist üblich.</small>
        </details>
        <small className="summary-tip">
          <Lightbulb size={12} aria-hidden="true" /> Tipp: Aktiv und konkret formulieren – z. B. „entwickelt“,
          „umgesetzt“, „implementiert“ oder „optimiert“.
        </small>
      </aside>

      <label className="checkbox-field full summary-visibility">
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => onChange((current) => setResumeSummaryVisible(current, event.target.checked))}
        />
        <span>Im Lebenslauf anzeigen</span>
      </label>
    </div>
  );
}
