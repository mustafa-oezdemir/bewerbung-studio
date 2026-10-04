import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeDiagnostics, logDiagnostic } from "./diagnostics";

describe("local diagnostics", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "bm-log-test-"));
    initializeDiagnostics(directory, "1.0.6", false);
  });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  it("writes only allowlisted fields and rejects path-like identifiers", async () => {
    logDiagnostic("error", {
      event: "document_failed",
      component: "documents",
      operation: "C:\\Users\\Applicant\\resume.pdf",
      error_code: "DOCUMENT_GENERATION_FAILED",
      error_type: "Error",
    });
    const record = JSON.parse(await readFile(path.join(directory, "app.jsonl"), "utf8"));
    expect(record).toMatchObject({
      service: "bewerbungsmanager-desktop",
      event: "document_failed",
      operation: "invalid",
      error_code: "DOCUMENT_GENERATION_FAILED",
    });
    expect(JSON.stringify(record)).not.toContain("Applicant");
  });

  it("suppresses debug logs in production", async () => {
    logDiagnostic("debug", { event: "test", component: "main" });
    await expect(readFile(path.join(directory, "app.jsonl"), "utf8")).rejects.toThrow();
  });
});
