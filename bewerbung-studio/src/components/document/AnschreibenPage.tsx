import { forwardRef, type CSSProperties, type ReactNode } from "react";
import type { AnschreibenModel } from "../../shared/anschreibenDocument";

/** The Briefkopf: the tree of `renderAnschreibenSenderMarkup` (PDF). */
export function SenderBlock({ sender }: { sender: AnschreibenModel["sender"] }) {
  return (
    <>
      <div className="letter-header">
        <p className="sender-line">
          <span className="sender-name">{sender.name}</span>
          <span className="sender-title">{sender.title}</span>
          <span className="sender-contact">{sender.contact}</span>
        </p>
      </div>
      <i className="paper-rule letter-rule" />
    </>
  );
}

/**
 * The Anschreiben page of the preview as React text nodes: the same element tree, classes, style variables and
 * stylesheets as `renderAnschreibenMarkup` (PDF), so both print alike. No user text is ever read as HTML.
 */
export const AnschreibenPage = forwardRef<HTMLDivElement, { model: AnschreibenModel; background?: ReactNode }>(
  function AnschreibenPage({ model, background }, ref) {
    return (
      <div
        className={model.className}
        data-resume-template={model.templateId}
        ref={ref}
        style={model.style as CSSProperties}>
        {model.stylesheets.map((css, index) => <style key={index}>{css}</style>)}
        {background}
        <div className="letter-preview">
          <SenderBlock sender={model.sender} />
          <address>
            {model.recipientLines.map((line, index) => (
              <span key={`${index}-${line}`}>
                {line}
                {index < model.recipientLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </address>
          <p className="paper-date">{model.placeDate}</p>
          <h3 className={model.subjectClassName || undefined}>{model.subject}</h3>
          <p className="letter-salutation">{model.greeting}</p>
          {model.paragraphs.map((paragraph, index) => (
            <p key={index} className={paragraph.closing ? "letter-body letter-closing" : "letter-body"}>{paragraph.text}</p>
          ))}
          <p className="letter-signature">
            <span>{model.signature.greeting}</span>
            {model.signature.source ? (
              <img className="signature-image" src={model.signature.source} alt={`Unterschrift von ${model.signature.name}`} />
            ) : null}
            <span className="signature-name">{model.signature.name}</span>
          </p>
          {model.attachments ? (
            <div className="letter-attachments">
              <strong>Anlagen</strong>
              {model.attachments.map((item) => <span key={item}>{item}</span>)}
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);
