import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "./external-url";

describe("external URL policy", () => {
  it("accepts ordinary HTTPS links", () => {
    expect(safeExternalUrl("https://example.com/jobs")).toBe("https://example.com/jobs");
  });

  it.each([
    "javascript:alert(1)",
    "file:///C:/secret.txt",
    "https://user:password@example.com/",
    "https://user@example.com/",
    "https://example.com@evil.example/",
    "not a URL",
  ])("rejects unsafe external link %s", (value) => {
    expect(safeExternalUrl(value)).toBeNull();
  });
});
