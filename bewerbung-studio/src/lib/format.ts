export const formatDate = (value?: string, withTime = false) => {
  if (!value) return "–";
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
};

export const toDateInput = (value?: string) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export const fromDateInput = (value: string) =>
  value ? new Date(`${value}T09:00:00`).toISOString() : undefined;

export const toDateTimeInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

export const fromDateTimeInput = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

export const statusTone = (status: string) => {
  if (status === "Absage" || status === "Zurückgezogen") return "danger";
  if (status === "Zusage") return "success";
  if (status.includes("Gespräch")) return "warning";
  if (status === "Entwurf" || status === "Archiviert") return "neutral";
  return "info";
};

export const initials = (value: string) =>
  value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
