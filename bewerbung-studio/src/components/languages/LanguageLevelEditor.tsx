import { Plus, Trash2 } from "lucide-react";
import { OrderControls } from "../profile/OrderControls";
import { moveListItem } from "../../shared/listOrder";
import type { CSSProperties } from "react";
import {
  cefrLanguageLevelCount,
  cefrLanguageLevels,
  formatLanguageEntry,
  getCefrLanguageLevel,
  getCefrLevelByScore,
  getLanguageLevelScore,
  isNativeLanguageLevel,
  parseLanguageEntry,
} from "../../features/languages/language-levels";

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
};

export function LanguageLevelEditor({ values, onChange }: Props) {
  const updateEntry = (
    index: number,
    name: string,
    level: string,
  ) =>
    onChange(
      values.map((value, currentIndex) =>
        currentIndex === index ? formatLanguageEntry(name, level) : value,
      ),
    );

  const removeEntry = (index: number) =>
    onChange(values.filter((_, currentIndex) => currentIndex !== index));

  return (
    <div className="language-level-editor">
      <div className="language-level-editor__heading">
        <div>
          <strong>Sprachen und GER-Niveau</strong>
          <small>
            Gemeinsamer Europäischer Referenzrahmen: A1 bis C2. Auswahl und
            Schieberegler sind miteinander verbunden.
          </small>
        </div>
        <button
          className="button secondary small-button"
          type="button"
          onClick={() => onChange([...values, ""])}
        >
          <Plus size={14} /> Sprache hinzufügen
        </button>
      </div>

      <div className="language-level-list">
        {values.map((value, index) => {
          const language = parseLanguageEntry(value);
          const level = getCefrLanguageLevel(language.level);
          const native = isNativeLanguageLevel(language.level);
          const score = getLanguageLevelScore(level);
          const progress = ((score - 1) / (cefrLanguageLevelCount - 1)) * 100;

          return (
            <article className="language-level-entry" key={index}>
              <OrderControls index={index} length={values.length} label={language.name || `Sprache ${index + 1}`} onMove={(target) => onChange(moveListItem(values, index, target))} />
              <label className="field language-name-field">
                <span>Sprache</span>
                <input
                  aria-label={`Sprache ${index + 1}`}
                  value={language.name}
                  onChange={(event) =>
                    updateEntry(index, event.target.value, language.level || level)
                  }
                />
              </label>
              <label className="field language-cefr-field">
                <span>GER-Niveau</span>
                <select
                  aria-label={`GER-Niveau für ${language.name || `Sprache ${index + 1}`}`}
                  value={native ? "Muttersprache" : level}
                  onChange={(event) =>
                    updateEntry(
                      index,
                      language.name,
                      event.target.value,
                    )
                  }
                >
                  {cefrLanguageLevels.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                  <option value="Muttersprache">Muttersprache</option>
                </select>
              </label>
              <div className="language-level-control">
                <div className="language-level-control__label">
                  <span>Sprachniveau einstellen</span>
                  <b>{native ? "Muttersprache" : level}</b>
                </div>
                <input
                  aria-label={`Sprachniveau für ${language.name || `Sprache ${index + 1}`} einstellen`}
                  aria-valuetext={native ? "Muttersprache" : level}
                  className="language-level-slider"
                  min="1"
                  max={cefrLanguageLevelCount}
                  step="1"
                  type="range"
                  value={score}
                  style={{ "--language-progress": `${progress}%` } as CSSProperties}
                  onChange={(event) =>
                    updateEntry(
                      index,
                      language.name,
                      getCefrLevelByScore(Number(event.target.value)),
                    )
                  }
                />
                <div className="language-level-graphic" aria-hidden="true">
                  {cefrLanguageLevels.map((entry, levelIndex) => (
                    <span
                      className={levelIndex < score ? "is-filled" : ""}
                      key={entry.value}
                    >
                      {entry.value}
                    </span>
                  ))}
                </div>
              </div>
              <button
                aria-label={`${language.name || `Sprache ${index + 1}`} löschen`}
                className="icon-button danger language-level-remove"
                title="Sprache löschen"
                type="button"
                onClick={() => removeEntry(index)}
              >
                <Trash2 size={15} />
              </button>
            </article>
          );
        })}
        {!values.length ? (
          <p className="language-level-empty">
            Noch keine Sprache erfasst. Fügen Sie eine Sprache hinzu und wählen
            Sie das Niveau A1–C2.
          </p>
        ) : null}
      </div>
    </div>
  );
}
