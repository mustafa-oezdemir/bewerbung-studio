export type AppErrorCode =
  | "WORKSPACE_LOCKED"
  | "VALIDATION_FAILED"
  | "RESOURCE_NOT_FOUND"
  | "FILE_LOCKED"
  | "FILE_NOT_FOUND"
  | "TEMPLATE_INVALID"
  | "INVALID_CREDENTIALS"
  | "DOCUMENT_GENERATION_FAILED"
  | "EXTERNAL_OPEN_FAILED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly expected: boolean;

  constructor(
    readonly code: AppErrorCode,
    message: string,
    options: { expected?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.expected = options.expected ?? false;
  }
}

export type IpcResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: AppErrorCode; message: string; operationId: string };
    };

export class IpcOperationError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly operationId: string,
  ) {
    super(`${message} (Fehler-ID: ${operationId})`);
    this.name = "IpcOperationError";
  }
}
