import type { Application } from "./schema";

type Contact = Application["contact"];

export const contactFullName = (contact: Contact) =>
  [contact.firstName, contact.lastName].filter(Boolean).join(" ");

const postalContactName = (contact: Contact) => {
  const name = contactFullName(contact);
  if (!name) return "";
  if (contact.salutation === "Herr") return `Herrn ${name}`;
  if (contact.salutation === "Frau") return `Frau ${name}`;
  return name;
};

type RecipientSource = Pick<Application, "company" | "contact" | "additionalContacts">;

export const applicationPostalContactLines = (application: RecipientSource) =>
  [application.contact, ...application.additionalContacts]
    .map(postalContactName)
    .filter(Boolean);

export const applicationContactDepartmentLines = (application: RecipientSource) =>
  Array.from(
    new Set(
      [application.contact, ...application.additionalContacts]
        .map((contact) => contact.position.trim())
        .filter(Boolean),
    ),
  );

export const applicationRecipientLines = (application: RecipientSource) =>
  [
    application.company.name,
    ...applicationPostalContactLines(application),
    ...applicationContactDepartmentLines(application),
    application.company.street,
    `${application.company.postalCode} ${application.company.city}`.trim(),
  ].filter(Boolean);

/** The recipient as the Anschreiben prints it: the edited address of the documents, else the application's. */
export const resolveRecipientLines = (application: RecipientSource, editedAddress = "") =>
  editedAddress.trim()
    ? editedAddress
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : applicationRecipientLines(application);

const greetingForContact = (contact: Contact) => {
  const name = contactFullName(contact);
  if (!name) return "";
  if (contact.salutation === "Herr" && contact.lastName) {
    return `Sehr geehrter Herr ${contact.lastName}`;
  }
  if (contact.salutation === "Frau" && contact.lastName) {
    return `Sehr geehrte Frau ${contact.lastName}`;
  }
  return `Guten Tag ${name}`;
};

export const applicationGreeting = (
  application: Pick<Application, "contact" | "additionalContacts">,
) => {
  const greetings = [application.contact, ...application.additionalContacts]
    .map(greetingForContact)
    .filter(Boolean)
    .map((greeting, index) =>
      index === 0
        ? greeting
        : `${greeting.charAt(0).toLocaleLowerCase("de-DE")}${greeting.slice(1)}`,
    );
  return greetings.length
    ? `${greetings.join(", ")},`
    : "Sehr geehrte Damen und Herren,";
};
