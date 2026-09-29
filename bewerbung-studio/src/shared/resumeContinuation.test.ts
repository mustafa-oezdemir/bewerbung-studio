import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import {
  ensureResumeHeaderContacts,
  keepDatesOnOneLine,
  normalizeContinuationHeader,
  removeContinuationSidebar,
  removeEmptyCareerSections,
  repeatResumeHeader,
} from "./resumeContinuation";

const root = (html: string) => parseHTML(`<html><body><div id="root">${html}</div></body></html>`).document.getElementById("root")!;

describe("continuation header", () => {
  it("adds missing contact fields to the first header and repeats it with its photo", () => {
    const first = root('<header class="sample-header"><h1>Mina Kaya</h1><h2>Entwicklerin</h2><img src="portrait.png"></header>');
    const second = root('<header class="sample-header compact"><h1>Mina Kaya</h1></header>');
    ensureResumeHeaderContacts(first, { email: "mina@example.com", phone: "+49 30 123456" });
    repeatResumeHeader(second, first.querySelector("header")!);
    expect(second.querySelector("header")?.outerHTML).toBe(first.querySelector("header")?.outerHTML);
    expect(second.querySelector('a[href="mailto:mina@example.com"]')).not.toBeNull();
    expect(second.querySelector('a[href="tel:+4930123456"]')).not.toBeNull();
    expect(second.querySelector("header img")?.getAttribute("src")).toBe("portrait.png");
    expect(second.querySelector("header.compact")).toBeNull();
  });

  it("replaces kicker and headline with a single page indicator", () => {
    const page = root(
      '<header class="modern-pdf-header compact"><div><p class="kicker">Lebenslauf · Fortsetzung</p><h1>Mina Kaya</h1><h2>Entwicklerin</h2></div></header>',
    );
    normalizeContinuationHeader(page, 2, 3);
    const header = page.querySelector("header")!;
    expect(header.hasAttribute("data-resume-continuation")).toBe(true);
    expect(header.querySelectorAll("h1")).toHaveLength(1);
    expect(header.querySelector("h2")).toBeNull();
    expect(header.querySelector(".kicker")).toBeNull();
    expect(header.querySelector("[data-resume-continuation-meta]")?.textContent).toBe("Lebenslauf · Seite 2 von 3");
    expect(header.textContent).not.toContain("Entwicklerin");
  });

  it("handles headers without a kicker, with a bare name element and with BEM previews", () => {
    const pehlione = root('<main><header class="pehlione-header"><h1>Mina Kaya</h1><h2>Entwicklerin</h2></header></main>');
    normalizeContinuationHeader(pehlione, 2, 2);
    expect(pehlione.querySelector("h2")).toBeNull();
    expect(pehlione.querySelector("header")?.textContent).toBe("Mina KayaLebenslauf · Seite 2 von 2");

    const tabellarisch = root('<header class="tabellarisch-pdf-continuation"><strong>Mina Kaya</strong><span>Entwicklerin</span></header>');
    normalizeContinuationHeader(tabellarisch, 2, 2);
    expect(tabellarisch.querySelector("span")).toBeNull();
    expect(tabellarisch.querySelector("strong")?.textContent).toBe("Mina Kaya");

    const preview = root('<header class="kompakt-header kompakt-header--compact"><p>Lebenslauf · Fortsetzung</p><h1>Mina Kaya</h1><h2>Entwicklerin</h2></header>');
    normalizeContinuationHeader(preview, 2, 2);
    expect(preview.querySelector("header")?.textContent).toBe("Mina KayaLebenslauf · Seite 2 von 2");
  });

  it("leaves only the name in Zweispaltig continuation headers numbered in the footer", () => {
    for (const className of ["zweispaltig-header zweispaltig-header--compact", "zweispaltig-pdf-header compact"]) {
      const page = root(`<header class="${className}"><div><p>Lebenslauf · Fortsetzung</p><h1>Mina Kaya</h1><h2>Entwicklerin</h2></div></header>`);
      normalizeContinuationHeader(page, 2, 2, { email: "mina@example.com", phone: "+49 30 123456" });
      expect(page.querySelector("header")?.textContent).toBe("Mina Kayamina@example.com+49 30 123456");
      expect(page.querySelector("[data-resume-continuation-meta]")).toBeNull();
      expect(page.querySelector('[data-resume-continuation-contact] a[href="mailto:mina@example.com"]')).not.toBeNull();
      expect(page.querySelector('[data-resume-continuation-contact] a[href="tel:+4930123456"]')).not.toBeNull();
      expect(page.querySelector("[data-resume-continuation-identity]")?.children[1]?.hasAttribute("data-resume-continuation-contact")).toBe(true);
    }
  });

  it("is idempotent and leaves pages without a compact header untouched", () => {
    const page = root('<header class="pehlione-header"><h1>Mina Kaya</h1><h2>Entwicklerin</h2></header>');
    normalizeContinuationHeader(page, 2, 2);
    normalizeContinuationHeader(page, 2, 2);
    expect(page.querySelectorAll("[data-resume-continuation-meta]")).toHaveLength(1);
    const first = root('<header class="hero"><h1>Mina Kaya</h1><h2>Entwicklerin</h2></header>');
    normalizeContinuationHeader(first, 1, 2);
    expect(first.querySelector("h2")?.textContent).toBe("Entwicklerin");
  });
});

describe("continuation sidebar", () => {
  it("drops the sidebar and gives the main column the full width", () => {
    const page = root('<div class="page-content" style="display:grid;grid-template-columns:63mm 1fr"><aside class="pehlione-pdf-sidebar-continuation"><h2>Mina Kaya</h2></aside><main>Inhalt</main></div>');
    removeContinuationSidebar(page);
    expect(page.querySelector("aside")).toBeNull();
    const host = page.querySelector(".page-content") as HTMLElement;
    expect(host.style.gridTemplateColumns).toContain("minmax(0, 1fr)");
    expect((page.querySelector("main") as HTMLElement).style.gridColumn).toBe("1");
  });

  it("keeps the regular first-page sidebar", () => {
    const page = root('<div><aside class="pehlione-sidebar"><h3>Kontakt</h3></aside><main>Inhalt</main></div>');
    removeContinuationSidebar(page);
    expect(page.querySelector("aside")).not.toBeNull();
  });
});

describe("orphan career headings", () => {
  const html =
    '<section data-managed-section="education"><h3>Ausbildung</h3></section>' +
    '<section data-managed-section="experience"><h3>Berufserfahrung</h3><p>Eintrag</p></section>';

  it("removes a heading whose entries live on another page", () => {
    const page = root(html);
    removeEmptyCareerSections(page, { experience: true, education: false });
    expect(page.querySelector('[data-managed-section="education"]')).toBeNull();
    expect(page.querySelector('[data-managed-section="experience"]')).not.toBeNull();
  });

  it("keeps sections that carry content or belong on the page", () => {
    const page = root(html);
    removeEmptyCareerSections(page, { experience: false, education: true });
    expect(page.querySelector('[data-managed-section="experience"]')).not.toBeNull();
    expect(page.querySelector('[data-managed-section="education"]')).not.toBeNull();
  });
});

describe("date ranges", () => {
  it("never wrap, but ordinary text may", () => {
    const page = root(
      '<time>11/2024 – 06/2025</time><p>2019 – Heute</p><span><svg></svg>01/2020 – 12/2021</span>' +
        '<span>Umzug 2020 – 2021 nach Berlin</span><div><b>2018 – 2019</b></div>',
    );
    keepDatesOnOneLine(page);
    const marked = Array.from(page.querySelectorAll("[data-resume-nowrap]")).map((node) => node.textContent);
    expect(marked).toEqual(["11/2024 – 06/2025", "2019 – Heute", "01/2020 – 12/2021", "2018 – 2019"]);
  });
});
