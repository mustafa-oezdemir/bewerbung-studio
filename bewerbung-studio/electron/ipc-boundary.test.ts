import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../src/shared/app-error";
import { initializeDiagnostics } from "./diagnostics";
import { normalizeError, runIpcOperation } from "./ipc-boundary";

describe("IPC error boundary", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "bm-ipc-test-"));
    initializeDiagnostics(directory, "test", false);
  });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  it("returns data without changing the preload contract", async () => {
    expect(await runIpcOperation("workspace:get", () => ({ value: 1 })))
      .toEqual({ ok: true, data: { value: 1 } });
  });

  it("preserves a typed expected error and correlates its safe log", async () => {
    const result = await runIpcOperation("applications:save", () => {
      throw new AppError("FILE_LOCKED", "Datei ist geöffnet.", { expected: true });
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ code: "FILE_LOCKED", message: "Datei ist geöffnet." });
    expect(result.error.operationId).toMatch(/^[0-9a-f-]{36}$/);
    const log = JSON.parse(await readFile(path.join(directory, "app.jsonl"), "utf8"));
    expect(log).toMatchObject({ level: "warn", error_code: "FILE_LOCKED", operation_id: result.error.operationId });
  });

  it("redacts unexpected error text, stack, and incoming payload", async () => {
    const secret = "password=top-secret applicant@example.com C:\\Users\\Applicant\\cv.docx";
    const result = await runIpcOperation("security:unlock", () => { throw new Error(secret); });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toBe("Ein unerwarteter Fehler ist aufgetreten.");
    expect(JSON.stringify(result)).not.toContain(secret);
    const log = await readFile(path.join(directory, "app.jsonl"), "utf8");
    expect(log).not.toContain("top-secret");
    expect(log).not.toContain("Applicant");
    expect(log).not.toContain("applicant@example.com");
    expect(log).toContain(result.error.operationId);
  });

  it("normalizes malformed input without exposing Zod details", async () => {
    const parsed = z.object({ password: z.string().min(20) }).safeParse({ password: "short" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const error = normalizeError(parsed.error);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.message).toBe("Die eingegebenen Daten sind ungültig.");
  });

  it("does not expose operating system paths in filesystem errors", () => {
    const error = Object.assign(new Error("ENOENT: C:\\private\\cv.pdf"), { code: "ENOENT" });
    expect(normalizeError(error).message).toBe("Die benötigte Datei wurde nicht gefunden.");
  });
});
