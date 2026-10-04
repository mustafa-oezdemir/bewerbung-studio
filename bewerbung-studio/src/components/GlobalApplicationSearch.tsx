import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchApplications } from "../lib/applicationSearch";
import type { Application } from "../shared/schema";

type Props = {
  applications: Application[];
  onSelect: (id: string) => void;
};

export function GlobalApplicationSearch({ applications, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => searchApplications(applications, query).slice(0, 6),
    [applications, query],
  );
  const showResults = open && Boolean(query.trim());

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (
        event.key === "Escape" &&
        rootRef.current?.contains(document.activeElement)
      ) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    const handleOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    setHighlightedIndex((current) =>
      Math.min(current, Math.max(results.length - 1, 0)),
    );
  }, [results.length]);

  const selectResult = (application: Application) => {
    setQuery("");
    setOpen(false);
    onSelect(application.id);
  };

  return (
    <div className="global-search-shell" ref={rootRef}>
      <div className="global-search">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          value={query}
          placeholder="Firma, Ansprechpartner, Stelle oder Stadt suchen"
          aria-label="Bewerbungen suchen"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls="global-search-results"
          aria-activedescendant={
            showResults && results[highlightedIndex]
              ? `global-search-result-${results[highlightedIndex].id}`
              : undefined
          }
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (!showResults || !results.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlightedIndex((current) => (current + 1) % results.length);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlightedIndex(
                (current) => (current - 1 + results.length) % results.length,
              );
            }
            if (event.key === "Enter") {
              event.preventDefault();
              selectResult(results[highlightedIndex]);
            }
          }}
        />
        {query ? (
          <button
            className="global-search-clear"
            type="button"
            title="Suche löschen"
            aria-label="Suche löschen"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}>
            <X size={14} />
          </button>
        ) : null}
      </div>
      {showResults ? (
        <div
          className="global-search-results"
          id="global-search-results"
          role="listbox">
          {results.length ? (
            results.map((application, index) => (
              <button
                id={`global-search-result-${application.id}`}
                key={application.id}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                className={index === highlightedIndex ? "active" : ""}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectResult(application)}>
                <span className="company-mark">
                  {application.company.name.slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <strong>{application.company.name}</strong>
                  <small>
                    {application.job.title} · {application.company.city}
                  </small>
                </span>
                <em>{application.status}</em>
              </button>
            ))
          ) : (
            <p>Keine passenden Bewerbungen.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
