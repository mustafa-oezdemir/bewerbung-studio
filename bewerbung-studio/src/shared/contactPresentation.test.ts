import { describe, expect, it } from "vitest";
import {
  externalUrl,
  formatPhoneForDisplay,
  formatUrlForDisplay,
} from "./contactPresentation";

describe("contact presentation", () => {
  it("formats a German mobile number only for presentation", () => {
    expect(formatPhoneForDisplay("+4917693153406")).toBe(
      "+49 176 93153406",
    );
  });

  it("keeps a valid LinkedIn target and a compact display label", () => {
    expect(externalUrl("linkedin.com/in/mustafa-oezdemir")).toBe(
      "https://linkedin.com/in/mustafa-oezdemir",
    );
    expect(
      formatUrlForDisplay("https://www.linkedin.com/in/mustafa-oezdemir/"),
    ).toBe("www.linkedin.com/in/mustafa-oezdemir");
  });
});
