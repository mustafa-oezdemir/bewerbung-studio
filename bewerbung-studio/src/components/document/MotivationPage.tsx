import type { CSSProperties } from "react";
import { SenderBlock } from "./AnschreibenPage";
import {
  motivationHeadingClassName,
  motivationLetterHeadingClassName,
  motivationLetterStyle,
  motivationRootClassName,
  type MotivationModel,
} from "../../shared/motivationDocument";

/**
 * The Motivationsschreiben page as React text nodes: the same element tree, classes and style variables as
 * `renderMotivationMarkup` (PDF), so `motivationCss` draws both alike. No user text is ever read as HTML.
 */
export function MotivationPage({ model }: { model: MotivationModel }) {
  if (model.letter) {
    const letter = model.letter;
    return (
      <article className={`${motivationRootClassName()} motivation--letter`} data-motivation-template={model.templateId}>
        <div className={letter.className} data-resume-template={letter.templateId} style={motivationLetterStyle({ ...model, letter }) as CSSProperties}>
          {letter.stylesheets.map((css, index) => <style key={index}>{css}</style>)}
          <div className="letter-preview">
            <SenderBlock sender={letter.sender} />
            <h3 className={motivationLetterHeadingClassName(letter)}>{model.heading}</h3>
            <p className="letter-salutation">{model.salutation}</p>
            {model.paragraphs.map((paragraph, index) => (
              <p key={`${paragraph.part}-${index}`} className={paragraph.part === "closing" ? "letter-body letter-closing" : "letter-body"} data-part={paragraph.part}>
                {paragraph.text}
              </p>
            ))}
            <div className="motivation-closing">
              <p className="letter-signature">
                <span>{model.closing.greeting}</span>
                {model.closing.signatureSource ? <img className="signature-image" src={model.closing.signatureSource} alt="Unterschrift" /> : null}
                <span className="signature-name">{model.closing.signer}</span>
              </p>
              {model.closing.placeDate ? <p className="paper-date motivation-place-date">{model.closing.placeDate}</p> : null}
            </div>
          </div>
        </div>
      </article>
    );
  }
  return (
    <article
      className={motivationRootClassName()}
      data-motivation-template={model.templateId}
      style={model.style as CSSProperties}>
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
