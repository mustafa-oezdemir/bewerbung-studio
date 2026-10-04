import type { Application } from "../shared/schema";

export const applicationMatchesQuery = (
  application: Application,
  query: string,
) => {
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  if (!normalizedQuery) return true;
  const contacts = [application.contact, ...application.additionalContacts];
  const searchableText = [
    application.company.name,
    application.job.title,
    application.company.city,
    application.status,
    ...contacts.flatMap((contact) => [
      contact.firstName,
      contact.lastName,
      [contact.firstName, contact.lastName].filter(Boolean).join(" "),
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase("de-DE");

  return normalizedQuery
    .split(/\s+/)
    .every((term) => searchableText.includes(term));
};

export const searchApplications = (
  applications: Application[],
  query: string,
) => applications.filter((application) => applicationMatchesQuery(application, query));
