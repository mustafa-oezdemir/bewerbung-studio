import { describe, expect, it } from "vitest";
import { parseDocumentFolderTarget, parseExportTarget } from "./ipc";

describe("Motivation IPC target allow-lists", () => {
  it("accepts Motivation as a document target and rejects path-like values", () => {
    expect(parseExportTarget("motivation")).toBe("motivation");
    expect(parseDocumentFolderTarget("motivation")).toBe("motivation");
    expect(parseExportTarget("../motivation")).toBeUndefined();
    // The two combined PDFs.
    expect(parseExportTarget("bewerbungsunterlagen")).toBe("bewerbungsunterlagen");
    expect(parseExportTarget("mappe")).toBe("mappe");
    expect(parseExportTarget("bewerbungsunterlagen/../mappe")).toBeUndefined();
    expect(parseDocumentFolderTarget("Motivation/../../data")).toBeUndefined();
  });
});
