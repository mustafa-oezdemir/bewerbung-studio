import { useLayoutEffect, useRef } from "react";
import {
  deckblattCss,
  fitDeckblattContacts,
  renderDeckblattMarkup,
  type DeckblattModel,
} from "../../shared/deckblattDesigns";

/**
 * The Deckblatt page of the preview. It prints the very markup and stylesheet the PDF export uses
 * (`shared/deckblattDesigns`), so a change of design or data shows up identically on both surfaces. After the
 * page is drawn, the contact rows are fitted to their room by the same script the exported page runs.
 */
export function DeckblattPreview({ model }: { model: DeckblattModel }) {
  const host = useRef<HTMLDivElement>(null);
  const markup = renderDeckblattMarkup(model);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    fitDeckblattContacts(element);
    void document.fonts?.ready.then(() => fitDeckblattContacts(element));
  }, [markup]);
  return (
    <>
      <style>{deckblattCss}</style>
      <div ref={host} className="deckblatt-host" dangerouslySetInnerHTML={{ __html: markup }} />
    </>
  );
}
