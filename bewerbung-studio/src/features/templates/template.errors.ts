export class TemplateError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "NOT_LOCAL"
      | "LOCKED"
      | "INVALID_PATH"
      | "INVALID_FORMAT"
      | "FILE_TOO_LARGE"
      | "CORRUPT"
      | "SYSTEM_TEMPLATE"
      | "PROTECTED_TEMPLATE",
  ) {
    super(message);
    this.name = "TemplateError";
  }
}

export const toTemplateError = (error: unknown) => {
  if (error instanceof TemplateError) return error;
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (["EBUSY", "EPERM", "EACCES"].includes(code)) {
    return new TemplateError(
      "Die Datei wird von einem anderen Programm verwendet.",
      "LOCKED",
    );
  }
  if (["ENOENT", "ENODATA", "EIO"].includes(code)) {
    return new TemplateError(
      "Die Vorlage ist derzeit nicht lokal verfügbar. Die Datei wird möglicherweise noch von OneDrive synchronisiert.",
      "NOT_LOCAL",
    );
  }
  return new TemplateError(
    "Die Vorlage konnte nicht gelesen werden.",
    "CORRUPT",
  );
};
