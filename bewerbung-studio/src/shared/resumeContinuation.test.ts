import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import {
  ensureResumeHeaderContacts,
  keepDatesOnOneLine,
  normalizeContinuationHeader,
  removeContinuationSidebar,
  removeEmptyCareerHint,
  removeEmptyCareerSections,
  repeatResumeHeader,
} from "./resumeContinuation";

const root = (html: string) => parseHTML(`<html><body><div id="root">${html}</div></body></html>`).document.getElementById("root")!;

describe("continuation header", () => {
  it("adds missing contact fields to the first header", () => {
    const first = root('<header class="sample-header"><h1>Mina Kaya</h1><h2>Entwicklerin</h2><img src="portrait.png"></header>');
    ensureResumeHeaderContacts(first, { email: "mina@example.com", phone: "+49 30 123456" });
    expect(first.querySelector('a[href="mailto:mina@example.com"]')).not.toBeNull();
    expect(first.querySelector('a[href="tel:+4930123456"]')).not.toBeNull();
    // under the Berufsbezeichnung, not between the name and the title
    expect(first.querySelector("h2")?.nextElementSibling?.hasAttribute("data-resume-header-extra-contact")).toBe(true);
  });

  const firstHeader = () => root(
    '<header class="sample-header"><div class="identity"><p class="kicker">Lebenslauf</p><h1>Mina Kaya</h1><p class="title">Entwicklerin</p>' +
    '<address class="contacts"><a href="tel:+4930123456"><i></i><span>+49 30 123456</span></a><a href="mailto:mina@example.com"><i></i><span>mina@example.com</span></a>' +
    '<a href="https://linkedin.com/in/mina"><i></i><span>linkedin.com/in/mina</span></a><span><i></i><span>Musterstraße 12, 35037 Marburg, Deutschland</span></span>' +
    '<span><i></i><span>Geb. 17.05.1990 in Ankara</span></span><span><i></i><span>Staatsangehörigkeit: deutsch</span></span></address></div>' +
    '<figure class="photo"><img src="portrait.png"></figure></header>',
  );
  const later = () => root('<header class="sample-header compact"><p class="kicker">Lebenslauf · Fortsetzung</p><h1>Mina Kaya</h1></header>');

  it("repeats name, title, heading and photo of the first header on a later page and no other personal detail", () => {
    const second = later();
    repeatResumeHeader(second, firstHeader().querySelector("header")!, undefined, { title: "Entwicklerin" });
    const header = second.querySelector("header")!;
    expect(header.querySelector("h1")?.textContent).toBe("Mina Kaya");
    expect(header.querySelector(".title")?.textContent).toBe("Entwicklerin");
    expect(header.querySelector(".kicker")?.textContent).toBe("Lebenslauf");
    expect(header.querySelector("img")?.getAttribute("src")).toBe("portrait.png");
    expect(header.querySelector("header.compact")).toBeNull();
    // nothing else: no contact block, no link, no address, no birth or nationality line, no empty icon shell
    expect(header.querySelector("address,a,i,.contacts")).toBeNull();
    expect(header.textContent?.replace(/\s+/g, " ").trim()).toBe("LebenslaufMina KayaEntwicklerin");
  });

  it("adds only the contacts the user chose for later pages", () => {
    const only = (contacts: { email?: string; phone?: string }) => {
      const second = later();
      repeatResumeHeader(second, firstHeader().querySelector("header")!, contacts, { title: "Entwicklerin" });
      return second.querySelector("header")!;
    };
    const email = only({ email: "mina@example.com" });
    expect(email.querySelector('a[href="mailto:mina@example.com"]')).not.toBeNull();
    expect(email.querySelector('a[href^="tel:"]')).toBeNull();
    const phone = only({ phone: "+49 30 123456" });
    expect(phone.querySelector('a[href="tel:+4930123456"]')).not.toBeNull();
    expect(phone.querySelector('a[href^="mailto:"]')).toBeNull();
    const both = only({ email: "mina@example.com", phone: "+49 30 123456" });
    for (const header of [email, phone, both]) {
      expect(header.textContent).not.toContain("Musterstraße");
      expect(header.textContent).not.toContain("Ankara");
      expect(header.textContent).not.toContain("deutsch");
      expect(header.querySelector('a[href^="https://"]')).toBeNull();
    }
    // the contacts stand under the title
    expect(both.querySelector(".title")?.nextElementSibling?.hasAttribute("data-resume-header-extra-contact")).toBe(true);
  });

  it("finds the title by its text when the markup nests it, and keeps a template's own name class", () => {
    const first = root(
      '<header class="zweispaltig-header"><div><h1 class="zweispaltig-header__name">Mina Kaya</h1><h2><span>Entwicklerin</span></h2>' +
      '<address class="zweispaltig-header__contacts"><span>Musterstraße 12</span></address></div></header>',
    );
    const second = later();
    repeatResumeHeader(second, first.querySelector("header")!, undefined, { title: "Entwicklerin" });
    expect(second.querySelector("header")?.textContent?.replace(/\s+/g, " ").trim()).toBe("Mina KayaEntwicklerin");
  });

  it("never carries a contact block or a link when the header has no name to anchor on", () => {
    const first = root('<header><span class="x">Mina Kaya</span><address><a href="https://github.com/mina">github</a></address><ul class="contact-list"><li>Musterstraße</li></ul></header>');
    const second = later();
    repeatResumeHeader(second, first.querySelector("header")!);
    expect(second.querySelector("address,a,ul")).toBeNull();
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

describe("career hint", () => {
  it("is removed from a page that merely has no career entry", () => {
    const page = root('<main><p class="muted">Berufserfahrung und Ausbildung im Profil ergänzen.</p><p>Berufserfahrung und Ausbildung im Profil ergänzen, bitte.</p></main>');
    removeEmptyCareerHint(page);
    expect(Array.from(page.querySelectorAll("p")).map((node) => node.textContent)).toEqual(["Berufserfahrung und Ausbildung im Profil ergänzen, bitte."]);
  });
});
