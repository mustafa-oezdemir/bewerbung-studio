export type TemplateTab =
  | "all"
  | "anschreiben"
  | "deckblatt"
  | "lebenslauf"
  | "documents"
  | "favorites";

const tabs: Array<{ id: TemplateTab; label: string }> = [
  { id: "all", label: "Alle Vorlagen" },
  { id: "anschreiben", label: "Anschreiben" },
  { id: "deckblatt", label: "Deckblatt" },
  { id: "lebenslauf", label: "Lebenslauf" },
  { id: "documents", label: "Eigene Dokumente" },
  { id: "favorites", label: "Favoriten" },
];

export function TemplateTabs({
  active,
  onChange,
}: {
  active: TemplateTab;
  onChange: (tab: TemplateTab) => void;
}) {
  return (
    <div className="template-library-tabs">
      {tabs.map((tab) => (
        <button
          className={active === tab.id ? "active" : ""}
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

