import type { CSSProperties } from "react";
import { AnschreibenLetterheadBlock } from "./AnschreibenPage";
import {
  motivationHeadingClassName,
  motivationRootClassName,
  type MotivationModel,
} from "../../shared/motivationDocument";

/**
 * The Motivationsschreiben page as React text nodes: the same element tree, classes and style variables as
 * `renderMotivationMarkup` (PDF), so `motivationCss` draws both alike. No user text is ever read as HTML.
 */
export function MotivationPage({ model }: { model: MotivationModel }) {
  return (
    <article
      className={motivationRootClassName()}
      data-motivation-template={model.templateId}
      style={model.style as CSSProperties}>
      {model.letterhead ? <AnschreibenLetterheadBlock letterhead={model.letterhead} /> : (
        <header className="mv-header">
          <h1 className="mv-name">{model.name}</h1>
          {model.contacts.length ? (
            <ul className="mv-contacts">
              {model.contacts.map((contact) => (
                <li key={contact.kind} data-kind={contact.kind}>
                  {contact.href ? <a href={contact.href}>{contact.text}</a> : contact.text}
                </li>
              ))}
            </ul>
          ) : null}
        </header>
      )}
      <h2 className={motivationHeadingClassName()}>{model.heading}</h2>
      <p className="mv-salutation">{model.salutation}</p>
      {model.paragraphs.length ? <div className="mv-body">
        {model.paragraphs.map((paragraph, index) => (
          <p key={`${paragraph.part}-${index}`} className="mv-paragraph" data-part={paragraph.part}>
            {paragraph.text}
          </p>
        ))}
      </div> : null}
      <footer className="mv-closing">
        <div className="mv-sign-off">
          <p className="mv-greeting">{model.closing.greeting}</p>
          {model.closing.signatureSource ? (
            <img className="mv-signature" src={model.closing.signatureSource} alt="Unterschrift" />
          ) : null}
          {model.closing.signer ? <p className="mv-signer">{model.closing.signer}</p> : null}
        </div>
        {model.closing.placeDate ? <p className="mv-place-date">{model.closing.placeDate}</p> : null}
      </footer>
    </article>
  );
}
