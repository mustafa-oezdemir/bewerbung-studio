import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { getSectionAbove } from "./resumeSpacing";

const page = (html: string) => parseHTML(`<html><body><div id="scope">${html}</div></body></html>`).document.getElementById("scope")!;
const section = (id: string, text = id) => `<section data-managed-section="${id}"><h2>${text}</h2></section>`;
const above = (scope: Element, id: string) => getSectionAbove(scope.querySelector(`[data-managed-section="${id}"]`)!, scope, scope.querySelector("#columns"))?.getAttribute("data-managed-section") ?? null;

describe("the section above a section", () => {
  it("is the previous sibling of a template that draws its sections side by side", () => {
    const scope = page(`<main>${section("experience")}${section("education")}</main>`);
    expect(above(scope, "education")).toBe("experience");
    expect(above(scope, "experience")).toBeNull();
  });

  it("is found through the wrapper that holds every section of Zweispaltig", () => {
    const scope = page(`<main><div class="wrap">${section("experience")}</div><div class="wrap">${section("education")}</div><div class="wrap">${section("languages")}</div></main>`);
    expect(above(scope, "education")).toBe("experience");
    expect(above(scope, "languages")).toBe("education");
    expect(above(scope, "experience")).toBeNull();
  });

  it("skips a wrapper that holds nothing (a section the page does not draw)", () => {
    const scope = page(`<main><div>${section("experience")}</div><div></div><div>${section("education")}</div></main>`);
    expect(above(scope, "education")).toBe("experience");
  });

  it("is none when content that is no section stands between them, or when the section is first in its column", () => {
    const scope = page(`<div id="columns"><main><div>${section("experience")}</div><p>Ein Foto</p><div>${section("education")}</div></main><aside><div>${section("languages")}</div></aside></div>`);
    expect(above(scope, "education")).toBeNull();
    expect(above(scope, "languages")).toBeNull();
  });
});
