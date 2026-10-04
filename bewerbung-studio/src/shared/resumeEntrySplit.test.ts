import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applyEntryBreaks } from "./resumeEntrySplit";
import type { ResumePageItem } from "./documentPagination";

const page = (html: string) => parseHTML(`<html><body><div id="root">${html}</div></body></html>`).document.getElementById("root")!;
const entry = (role: string, bullets: number) =>
  `<article class="entry"><h3>${role}</h3><ul>${Array.from({ length: bullets }, (_, index) => `<li>${role} Punkt ${index + 1}</li>`).join("")}</ul></article>`;
const texts = (root: Element) => Array.from(root.querySelectorAll("li")).map((node) => node.textContent);

describe("experience entries that break between two pages", () => {
  const items = (from: number, to: number): ResumePageItem[] => [
    { kind: "experience", id: "a", weight: 10 },
    { kind: "experience", id: "b", weight: 10, bullets: { from, to, total: 5 } },
  ];

  it("keeps the first bullets on page one and does not mark the entry as a continuation", () => {
    const root = page(`<section>${entry("A", 3)}${entry("B", 5)}</section>`);
    applyEntryBreaks([root.querySelector("section")!], ".entry", "h3", items(0, 2));
    expect(texts(root)).toEqual(["A Punkt 1", "A Punkt 2", "A Punkt 3", "B Punkt 1", "B Punkt 2"]);
    const second = root.querySelectorAll(".entry")[1];
    expect(second.hasAttribute("data-resume-entry-continues")).toBe(true);
    expect(second.hasAttribute("data-resume-entry-continued")).toBe(false);
    expect(root.querySelector("[data-resume-entry-marker]")).toBeNull();
  });

  it("draws the rest on page two under the repeated header, marked as a continuation", () => {
    const root = page(`<section>${entry("A", 3)}${entry("B", 5)}</section>`);
    applyEntryBreaks([root.querySelector("section")!], ".entry", "h3", items(2, 5));
    expect(texts(root).slice(3)).toEqual(["B Punkt 3", "B Punkt 4", "B Punkt 5"]);
    const second = root.querySelectorAll(".entry")[1];
    expect(second.hasAttribute("data-resume-entry-continued")).toBe(true);
    expect(second.querySelector("h3")?.textContent).toBe("B· Fortsetzung");
    expect(root.querySelectorAll("[data-resume-entry-marker]")).toHaveLength(1);
  });

  it("leaves whole entries alone", () => {
    const root = page(`<section>${entry("A", 3)}${entry("B", 5)}</section>`);
    applyEntryBreaks([root.querySelector("section")!], ".entry", "h3", [
      { kind: "experience", id: "a", weight: 10 },
      { kind: "experience", id: "b", weight: 10 },
    ]);
    expect(texts(root)).toHaveLength(8);
  });

  it("keeps every entry whole when the markup does not match the plan", () => {
    const root = page(`<section>${entry("A", 3)}</section>`);
    applyEntryBreaks([root.querySelector("section")!], ".entry", "h3", items(0, 2));
    expect(texts(root)).toHaveLength(3);
  });

  it("ignores a list whose length is not the planned bullet count", () => {
    const root = page(`<section>${entry("A", 3)}${entry("B", 4)}</section>`);
    applyEntryBreaks([root.querySelector("section")!], ".entry", "h3", items(0, 2));
    expect(texts(root)).toHaveLength(7);
  });
});
