import { Check, Circle } from "lucide-react";
import { getSummaryGuidance, summaryRecommendation } from "../../shared/resumeSummary";

const recommendationText = `${summaryRecommendation.sentences.min}–${summaryRecommendation.sentences.max} Sätze · ca. ${summaryRecommendation.words.min}–${summaryRecommendation.words.max} Wörter`;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The live count of a Kurzprofil and the soft recommendation (3–5 Sätze, ca. 50–100 Wörter). It only informs:
 * a shorter or longer text is never an error and never blocks a save.
 */
export function SummaryCounter({ value }: { value: string }) {
  const guidance = getSummaryGuidance(value);
  const hint =
    guidance.wordRange === "empty"
      ? undefined
      : guidance.recommended
        ? undefined
        : guidance.wordRange === "short" || guidance.sentenceRange === "short"
          ? "Etwas ausführlicher darf es sein."
          : "Etwas kürzer wirkt im Lebenslauf klarer.";
  return (
    <div className="summary-counter" aria-live="polite">
      <strong>
        {plural(guidance.words, "Wort", "Wörter")} · {plural(guidance.sentences, "Satz", "Sätze")}
      </strong>
      {guidance.wordRange === "empty" ? (
        <small>Empfohlen: {recommendationText}</small>
      ) : (
        <small className={guidance.recommended ? "is-recommended" : undefined}>
          {guidance.recommended ? <Check size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{" "}
          {guidance.recommended ? "Empfohlener Umfang" : "Empfohlen"}: {recommendationText}
          {hint ? ` – ${hint}` : ""}
        </small>
      )}
    </div>
  );
}
