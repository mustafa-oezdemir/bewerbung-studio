import { describe, expect, it } from "vitest";
import { resolveResumeFooterWebsite, resumeFooterWebsiteSource } from "./resumeFooter";

const profile = (overrides: Record<string, unknown> = {}) => ({
  portfolio: "https://pehlione.com/", github: "https://github.com/mina", linkedin: "linkedin.com/in/mina",
  resumeClosing: { showPlace: true, showDate: true, showSignature: true, showWebsite: true },
  ...overrides,
});

describe("resolveResumeFooterWebsite", () => {
  it("shows the website only when the user switched it on", () => {
    expect(resolveResumeFooterWebsite(profile())).toEqual({ text: "https://pehlione.com/", href: "https://pehlione.com/" });
    expect(resolveResumeFooterWebsite(profile({ resumeClosing: { showPlace: true, showDate: true, showSignature: true, showWebsite: false } }))).toBeNull();
    // Profiles saved before the switch existed show no footer website.
    expect(resolveResumeFooterWebsite(profile({ resumeClosing: { showPlace: true, showDate: true, showSignature: true } }))).toBeNull();
    expect(resolveResumeFooterWebsite(undefined)).toBeNull();
  });

  it("never shows it in the ATS output", () => {
    expect(resolveResumeFooterWebsite(profile(), true)).toBeNull();
  });

  it("keeps the historic order website, GitHub, LinkedIn and normalises only the link target", () => {
    expect(resolveResumeFooterWebsite(profile({ portfolio: " pehlione.com " }))).toEqual({ text: "pehlione.com", href: "https://pehlione.com" });
    expect(resolveResumeFooterWebsite(profile({ portfolio: "" }))?.text).toBe("https://github.com/mina");
    expect(resolveResumeFooterWebsite(profile({ portfolio: "", github: "" }))).toEqual({ text: "linkedin.com/in/mina", href: "https://linkedin.com/in/mina" });
    expect(resolveResumeFooterWebsite(profile({ portfolio: "", github: "", linkedin: "" }))).toBeNull();
    expect(resumeFooterWebsiteSource({ portfolio: "", github: "  ", linkedin: "x.de" })).toBe("x.de");
  });

  it("drops a script-like target instead of linking it", () => {
    expect(resolveResumeFooterWebsite(profile({ portfolio: "javascript:alert(1)" }))?.href).toBe("https://alert(1)");
  });
});
