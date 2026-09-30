import type { Application } from "./schema";

export type ApplicationDateSource = Pick<Application, "sentAt" | "createdAt">;

export const getApplicationDate = (application: ApplicationDateSource) =>
  new Date(application.sentAt ?? application.createdAt);

export const formatApplicationDate = (application: ApplicationDateSource) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(getApplicationDate(application));

/**
 * The application date as an ISO calendar date (`YYYY-MM-DD`), in the same local time zone as the
 * other formats. Kept for callers that need the ISO representation;
 * an unreadable date yields an empty string.
 */
export const formatApplicationDateIso = (application: ApplicationDateSource) => {
  const date = getApplicationDate(application);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const formatApplicationDateFolder = (date: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

export const formatApplicationDateLong = (application: ApplicationDateSource) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(getApplicationDate(application));

export const applicationDateChanged = (
  previous: ApplicationDateSource,
  next: ApplicationDateSource,
) => formatApplicationDate(previous) !== formatApplicationDate(next);
