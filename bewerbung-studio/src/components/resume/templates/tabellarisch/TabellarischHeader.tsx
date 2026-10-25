import { Fragment } from "react";
import { ContactIcon } from "../ContactIcon";
import type { TabellarischHeaderProps } from "./tabellarisch.types";
import { getTabellarischHeaderContacts, type TabellarischHeaderContact } from "../../../../shared/tabellarischHeaderContacts";

export function TabellarischHeader({
  name,
  profile,
  photoSource,
  atsMode,
}: TabellarischHeaderProps) {
  const contacts = getTabellarischHeaderContacts(profile);
  const primaryContacts = contacts.filter((contact) => contact.primary);
  const extraContacts = contacts.filter((contact) => !contact.primary);
  const renderContact = (contact: TabellarischHeaderContact, icon: boolean) => {
    const value = <>{atsMode ? <strong>{contact.label}: </strong> : null}{contact.text}</>;
    return (
      <span data-contact-kind={contact.kind} aria-label={`${contact.label}: ${contact.text}`}>
        {icon && !atsMode ? <ContactIcon {...contact} value={contact.text} /> : null}
        {contact.href ? <a href={contact.href}>{value}</a> : <span>{value}</span>}
      </span>
    );
  };

  return (
    <header
      className={`tabellarisch-header ${!photoSource || atsMode ? "tabellarisch-header--without-photo" : ""}`}
      data-element-id="tabellarisch.header"
    >
      <div className="tabellarisch-header__identity">
        <h1 className="tabellarisch-header__name">{name}</h1>
        {profile?.title ? (
          <p className="tabellarisch-header__title">{profile.title}</p>
        ) : null}
        {primaryContacts.length ? <address className="tabellarisch-header__primary-contacts">
          {primaryContacts.map((contact, index) => <Fragment key={contact.kind}>
            {index ? <span className="tabellarisch-header__separator" aria-hidden="true"> | </span> : null}
            {renderContact(contact, false)}
          </Fragment>)}
        </address> : null}
        {extraContacts.length ? <address className="tabellarisch-header__contacts">
          {extraContacts.map((contact, index) => <Fragment key={`${contact.kind}-${index}`}>
            {renderContact(contact, true)}
          </Fragment>)}
        </address> : null}
      </div>

      {photoSource && !atsMode ? (
        <figure className="tabellarisch-header__photo">
          <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
        </figure>
      ) : null}
    </header>
  );
}
