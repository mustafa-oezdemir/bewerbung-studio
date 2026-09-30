import type { ApplicantProfile, Application, Attachment, DocumentDraft } from "./schema";
import {
  fontSizeToPt,
  getDocumentFont,
  lineHeightLevelToValue,
  marginLevelToMm,
  type DocumentDesignSettings,
} from "./documentDesign";
import { createCoverSubject } from "./coverLetter";
import { formatApplicationDate } from "./applicationDate";
import { renderContactIcon } from "./contactIcons";
import { getProfileMediaSource } from "./profileMedia";
import { getProfessionalTitle } from "./profileSelection";
import { getReadableTextColor } from "./templates";
import {
  getDeckblattCompetencies,
  getDeckblattContacts,
  getDeckblattDocuments,
  type DeckblattContact,
} from "./deckblatt";
import {
  defaultDeckblattDesign,
  deckblattDesignIds,
  type DeckblattDesignId,
} from "./deckblattDesignIds";

export { defaultDeckblattDesign, deckblattDesignIds, type DeckblattDesignId };

/**
 * The Deckblatt designs. One registry, one data model, one markup and one stylesheet serve the preview and the
 * PDF, so a design can never look different on the two surfaces. The content comes from the profile, the
 * application and its document list; the colours and fonts from the design settings of the application.
 */
export type DeckblattDesign = {
  id: DeckblattDesignId;
  label: string;
  description: string;
  /** The design draws the background of the document design (the programming-language layer) behind its page. */
  usesDocumentBackground: boolean;
};

export const deckblattDesigns: readonly DeckblattDesign[] = [
  {
    id: "klassisch",
    label: "Klassisch",
    description: "Titel, Foto und Kurzprofil über einer klaren Linie – das bisherige Deckblatt.",
    usesDocumentBackground: true,
  },
  {
    id: "pastell",
    label: "Pastell",
    description: "Weiche, runde Farbflächen, großes Rundfoto, Name groß und Kontakt mit Anlagen unten.",
    usesDocumentBackground: false,
  },
  {
    id: "akzentband",
    label: "Akzentband",
    description: "Farbiges Seitenband mit Foto und Kontakt, rechts Betreff, Name, Profil und Anlagen.",
    usesDocumentBackground: false,
  },
];

export const getDeckblattDesign = (id: string | undefined): DeckblattDesign =>
  deckblattDesigns.find((design) => design.id === id) ?? deckblattDesigns[0];

export type DeckblattModel = {
  designId: DeckblattDesignId;
  /** `Bewerbung als …`, without a repeated prefix. */
  subject: string;
  company: string;
  location: string;
  date: string;
  name: string;
  initials: string;
  professionalTitle: string;
  statement: string;
  photoSource: string;
  contacts: DeckblattContact[];
  competencies: string[];
  documents: string[];
  /** CSS custom properties of the page (colours, fonts, sizes), identical on both surfaces. */
  style: Record<string, string>;
};

export type DeckblattInput = {
  application: Pick<Application, "id" | "company" | "job" | "sentAt" | "createdAt">;
  profile: ApplicantProfile | undefined;
  documents: DocumentDraft;
  attachments: readonly Attachment[];
  accentColor: string;
  secondaryColor: string;
  settings: DocumentDesignSettings;
};

/** `hex` at the given strength over white, e.g. 0.3 = a soft tint. */
const tint = (hex: string, strength: number) => {
  const channels = /^#[0-9a-f]{6}$/i.test(hex) ? [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) : [0, 0, 0];
  return `#${channels.map((channel) => Math.round(255 - (255 - channel) * strength).toString(16).padStart(2, "0")).join("")}`;
};

export const getDeckblattStyle = (
  accentColor: string,
  secondaryColor: string,
  settings: DocumentDesignSettings,
): Record<string, string> => {
  const bodyFont = getDocumentFont(settings.fontId);
  const headingFont = getDocumentFont(settings.headingFontId);
  return {
    "--accent": accentColor,
    "--secondary": secondaryColor,
    "--on-accent": getReadableTextColor(accentColor),
    // Soft areas of the designs: tints of the two theme colours. A light secondary colour is used almost as it is,
    // a dark one only as a pale wash.
    "--tint-strong": tint(accentColor, 0.6),
    "--tint-soft": tint(accentColor, 0.28),
    "--tint-faint": tint(accentColor, 0.14),
    "--tint-dots": tint(accentColor, 0.55),
    "--tint-sand": tint(secondaryColor, getReadableTextColor(secondaryColor) === "#ffffff" ? 0.2 : 1),
    "--ink": settings.textColor,
    "--heading": settings.headingColor,
    "--muted": "#5c6870",
    "--line": settings.lineColor,
    "--page-background": settings.backgroundColor,
    "--doc-margin": `${marginLevelToMm[settings.marginLevel]}mm`,
    "--body-size": `${fontSizeToPt[settings.fontSize]}pt`,
    "--body-line": String(lineHeightLevelToValue[settings.lineHeightLevel]),
    "--body-font": bodyFont.family,
    "--heading-font": headingFont.family,
    "--heading-weight": String(headingFont.headingWeight),
  };
};

export const buildDeckblattModel = ({
  application,
  profile,
  documents,
  attachments,
  accentColor,
  secondaryColor,
  settings,
}: DeckblattInput): DeckblattModel => ({
  designId: getDeckblattDesign(documents.coverSheetDesign).id,
  subject: createCoverSubject(application.job.title),
  company: application.company.name,
  location: application.company.city ?? "",
  date: formatApplicationDate(application),
  name: profile ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") : "Vorname Nachname",
  initials: profile ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() : "VN",
  professionalTitle: getProfessionalTitle(profile),
  statement: documents.deckblattStatement || profile?.summary || "",
  photoSource: getProfileMediaSource(profile?.photoPath),
  contacts: getDeckblattContacts(profile, documents.coverSheetContactVisibility),
  competencies: getDeckblattCompetencies(profile, application),
  documents: getDeckblattDocuments(attachments, application.id, documents.documentListSettings),
  style: getDeckblattStyle(accentColor, secondaryColor, settings),
});

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const contactKinds: Record<string, string> = {
  Adresse: "location",
  Telefon: "phone",
  "E-Mail": "email",
  LinkedIn: "linkedin",
  GitHub: "github",
  Website: "portfolio",
};

const contactValue = (contact: DeckblattContact) => {
  const value = escapeHtml(contact.value);
  return contact.href ? `<a href="${escapeHtml(contact.href)}">${value}</a>` : value;
};

/** One contact row: icon and value on a single line. */
const iconContactItem = (contact: DeckblattContact) => {
  const kind = contactKinds[contact.label] ?? "portfolio";
  return `<li data-contact-kind="${kind}"><i aria-hidden="true">${renderContactIcon({ kind })}</i><span>${contactValue(contact)}</span></li>`;
};

const iconContactList = (contacts: DeckblattContact[], className = "") =>
  `<ul class="dk-contacts${className ? ` ${className}` : ""}">${contacts.map(iconContactItem).join("")}</ul>`;

const list = (items: string[]) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

const initialsMarkup = (model: DeckblattModel) => `<span class="dk-initials" aria-hidden="true">${escapeHtml(model.initials)}</span>`;

const photoMarkup = (model: DeckblattModel) =>
  model.photoSource
    ? `<img src="${escapeHtml(model.photoSource)}" alt="">`
    : initialsMarkup(model);

const metaLines = (model: DeckblattModel) => [
  `bei ${escapeHtml(model.company)}`,
  [model.location ? `Standort: ${escapeHtml(model.location)}` : "", escapeHtml(model.date)].filter(Boolean).join(" · "),
];

const nameSize = (name: string) => (name.length > 32 ? "xlong" : name.length > 22 ? "long" : "normal");

const klassisch = (model: DeckblattModel) => `
  <div class="page-content cover-content">
    <div class="rule"></div>
    <section class="cover-hero"><div><h1 class="cover-subject">${escapeHtml(model.subject)}</h1><p class="cover-company">bei ${escapeHtml(model.company)}</p>${
      model.location ? `<p class="cover-location">Standort: ${escapeHtml(model.location)}</p>` : ""
    }<p class="cover-location">${escapeHtml(model.date)}</p></div>${
      model.photoSource ? `<img class="cover-photo" src="${escapeHtml(model.photoSource)}" alt="">` : ""
    }</section>
    <section class="cover-identity"><h2>${escapeHtml(model.name)}</h2>${
      model.professionalTitle ? `<p>${escapeHtml(model.professionalTitle)}</p>` : ""
    }${model.statement ? `<p class="cover-statement">${escapeHtml(model.statement)}</p>` : ""}</section>
    <section class="cover-details"><div><h3>Bewerbungsunterlagen</h3>${list(model.documents)}</div><div>${
      model.competencies.length
        ? `<h3>Kernkompetenzen</h3><p class="cover-competencies">${model.competencies.map(escapeHtml).join(" · ")}</p>`
        : ""
    }${
      model.contacts.length
        ? `<h3>Kontakt</h3><ul>${model.contacts
            .map((contact) => `<li><strong>${escapeHtml(contact.label)}</strong> ${contactValue(contact)}</li>`)
            .join("")}</ul>`
        : ""
    }</div></section>
  </div>`;

const pastell = (model: DeckblattModel) => `
  <i class="dk-shape dk-sand"></i><i class="dk-shape dk-mint"></i>
  <i class="dk-dots dk-dots--corner"></i><i class="dk-dots dk-dots--right"></i>
  <div class="dk-frame"><div class="dk-photo">${photoMarkup(model)}</div></div>
  <header class="dk-identity"><h2 class="dk-name dk-name--${nameSize(model.name)}">${escapeHtml(model.name)}</h2>${
    model.professionalTitle ? `<p class="dk-title">${escapeHtml(model.professionalTitle)}</p>` : ""
  }</header>
  <div class="dk-lower">
    <p class="dk-subject"><b>${escapeHtml(model.subject)}</b>${metaLines(model)
      .map((line) => `<span>${line}</span>`)
      .join("")}</p>
    <div class="dk-lower-grid">${
      model.contacts.length ? iconContactList(model.contacts, model.contacts.length > 3 ? "dk-contacts--cols" : "") : "<div></div>"
    }${
      model.documents.length
        ? `<div class="dk-docs${model.documents.length > 6 ? " dk-docs--many" : ""}"><h3>Anlagen:</h3>${list(model.documents)}</div>`
        : ""
    }</div>
  </div>`;

const akzentband = (model: DeckblattModel) => `
  <aside class="dk-band">
    <div class="dk-band-photo">${photoMarkup(model)}</div>
    ${
      model.contacts.length
        ? `<div class="dk-band-contact"><h3>Kontakt</h3>${iconContactList(model.contacts)}</div>`
        : ""
    }
  </aside>
  <main class="dk-main">
    <p class="dk-kicker">Bewerbung</p>
    <h1 class="dk-subject">${escapeHtml(model.subject)}</h1>
    <p class="dk-meta">${metaLines(model)
      .map((line) => `<span>${line}</span>`)
      .join("")}</p>
    <i class="dk-rule"></i>
    <h2 class="dk-name dk-name--${nameSize(model.name)}">${escapeHtml(model.name)}</h2>${
      model.professionalTitle ? `<p class="dk-title">${escapeHtml(model.professionalTitle)}</p>` : ""
    }${model.statement ? `<p class="dk-statement">${escapeHtml(model.statement)}</p>` : ""}
    <div class="dk-bottom${model.documents.length > 6 ? " dk-bottom--many" : ""}">${
      model.competencies.length
        ? `<div><h3>Kernkompetenzen</h3><p class="dk-competencies">${model.competencies.map(escapeHtml).join(" · ")}</p></div>`
        : ""
    }${model.documents.length ? `<div><h3>Anlagen</h3>${list(model.documents)}</div>` : ""}</div>
  </main>`;

/**
 * The contact rows of Pastell and Akzentband never wrap. The room they have depends on the text and the document
 * font, so the page measures itself: the text size of the rows shrinks (down to a limit) until every row is whole
 * inside the page, and only when even that is not enough do the rows may wrap instead of leaving the page.
 * The preview runs this source after it has drawn the page, the PDF export inside the exported page - one source,
 * one result on both surfaces.
 */
const deckblattFitSource = [
  'var pages = root.querySelectorAll(".deckblatt[data-deckblatt-design]");',
  'for (var index = 0; index < pages.length; index++) {',
  '  var page = pages[index];',
  '  var design = page.getAttribute("data-deckblatt-design");',
  '  var list = page.querySelector(".dk-contacts");',
  '  if (!list || (design !== "pastell" && design !== "akzentband")) continue;',
  '  var perMm = page.getBoundingClientRect().width / 210;',
  '  var minPt = design === "pastell" ? 7.4 : 6.8;',
  '  var spans = list.querySelectorAll("li > span");',
  '  var overflows = function () {',
  '    var right = 0;',
  '    for (var row = 0; row < spans.length; row++) right = Math.max(right, spans[row].getBoundingClientRect().right);',
  '    if (design === "akzentband") return right > page.querySelector(".dk-band").getBoundingClientRect().right - 10.4 * perMm + 0.5;',
  '    var docs = page.querySelector(".dk-docs");',
  '    var reserve = docs ? (docs.classList.contains("dk-docs--many") ? 66 : 37) : 0;',
  '    return right + reserve * perMm > page.querySelector(".dk-lower-grid").getBoundingClientRect().right + 0.5;',
  '  };',
  '  var size = parseFloat(getComputedStyle(list.querySelector("li")).fontSize) * 0.75;',
  '  var shrink = function (floor) {',
  '    while (overflows() && size > floor) {',
  '      size = Math.round((size - 0.2) * 10) / 10;',
  '      page.style.setProperty("--dk-contact-size", size + "pt");',
  '    }',
  '  };',
  '  if (design === "pastell" && list.classList.contains("dk-contacts--cols")) {',
  '    var base = size;',
  '    shrink(7.8);',
  '    if (overflows()) {',
  '      list.classList.remove("dk-contacts--cols");',
  '      size = base;',
  '      page.style.setProperty("--dk-contact-size", size + "pt");',
  '    }',
  '  }',
  '  shrink(minPt);',
  '  if (overflows()) list.classList.add("dk-contacts--wrap");',
  '}',
].join("\n");

/** Runs the fitting on the pages below `root`; the preview calls it after every render. */
export const fitDeckblattContacts = new Function("root", deckblattFitSource) as (root: ParentNode) => void;

/** The same fitting as a script of the exported page (after the fonts are there, too). */
export const deckblattFitScript = `<script>(function(run){run(document);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){run(document)})})(function(root){${deckblattFitSource}})</script>`;

const renderers: Record<DeckblattDesignId, (model: DeckblattModel) => string> = { klassisch, pastell, akzentband };

const styleAttribute = (style: Record<string, string>) =>
  escapeHtml(Object.entries(style).map(([name, value]) => `${name}:${value}`).join(";"));

/** The markup of the whole Deckblatt page (A4); the preview and the PDF both print exactly this. */
export const renderDeckblattMarkup = (model: DeckblattModel) =>
  `<div class="deckblatt deckblatt--${model.designId}" data-deckblatt-design="${model.designId}" style="${styleAttribute(model.style)}">${renderers[model.designId](model)}</div>`;

/**
 * The stylesheet of all designs, scoped to `.deckblatt`. The rules carry the root class so the page rules of
 * either surface (`.document-paper p`, `.page h1`, the browser's paragraph margins) cannot reach the text.
 */
export const deckblattCss = `
.deckblatt{position:relative;z-index:1;width:100%;height:100%;overflow:hidden;color:var(--ink);font-family:var(--body-font);font-size:var(--body-size);line-height:normal;text-align:left;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.deckblatt *{box-sizing:border-box}
.deckblatt :is(h1,h2,h3,p,ul,li,address,aside,main,header,section){margin:0;padding:0;font-size:var(--body-size);font-weight:400;line-height:normal;letter-spacing:normal;text-transform:none;color:inherit;font-family:inherit}
.deckblatt ul{list-style:none}
.deckblatt a{color:inherit;text-decoration:none}
.deckblatt li{line-height:var(--body-line)}
.deckblatt img{display:block}

.deckblatt .cover-content{position:relative;z-index:1;width:100%;height:100%;padding:var(--doc-margin)}
.deckblatt .rule{height:4px;margin-bottom:22mm;background:var(--accent)}
.deckblatt .cover-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:12mm;padding-bottom:11mm;border-bottom:1px solid var(--line)}
.deckblatt .cover-subject{max-width:125mm;margin:4mm 0 2mm;font-family:var(--heading-font);font-size:28pt;font-weight:var(--heading-weight);line-height:1.05;color:var(--heading)}
.deckblatt .cover-company{margin:1em 0;line-height:var(--body-line);color:var(--muted)}
.deckblatt .cover-location{margin:3mm 0 0;font-size:9pt;line-height:var(--body-line);color:var(--muted)}
.deckblatt .cover-photo{width:36mm;height:36mm;flex:0 0 auto;border-radius:50%;object-fit:cover}
.deckblatt .cover-identity{width:100%;margin-top:21mm}
.deckblatt .cover-identity h2{margin:0 0 2mm;font-family:var(--heading-font);font-size:19pt;font-weight:var(--heading-weight);color:var(--heading)}
.deckblatt .cover-identity>p{margin:0;line-height:var(--body-line)}
.deckblatt .cover-statement{width:100%;margin-top:5mm!important;line-height:1.45!important;text-align:justify;text-justify:inter-word;hyphens:auto}
.deckblatt .cover-details{display:grid;grid-template-columns:34% minmax(0,1fr);gap:0;margin-top:23mm;padding-top:6mm;border-top:1px solid var(--line)}
.deckblatt .cover-details>div:nth-child(2){padding-left:4mm}
.deckblatt .cover-details h3{margin:0 0 3mm;font-family:var(--heading-font);font-size:10pt;font-weight:var(--heading-weight);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.deckblatt .cover-details h3:not(:first-child){margin-top:7mm}
.deckblatt .cover-details ul{display:grid;gap:1.5mm}
.deckblatt .cover-details li{overflow-wrap:anywhere}
.deckblatt .cover-details strong{display:inline-block;min-width:18mm;font-weight:700}
.deckblatt .cover-competencies{margin:0;line-height:1.55}

.deckblatt .dk-name,.deckblatt .dk-subject b,.deckblatt h3{font-family:var(--heading-font)}
.deckblatt--pastell,.deckblatt--akzentband{background:var(--page-background)}
.deckblatt .dk-contacts{display:grid;gap:2mm}
.deckblatt .dk-contacts li{display:flex;align-items:center;gap:3.4mm;font-size:10pt;line-height:1.25;white-space:nowrap;overflow-wrap:normal;word-break:normal}
.deckblatt .dk-contacts li i{display:grid;flex:0 0 6.4mm;width:6.4mm;height:6.4mm;place-items:center;border-radius:50%;font-style:normal}
.deckblatt .dk-contacts li span{white-space:nowrap;overflow-wrap:normal;word-break:normal}
.deckblatt .dk-contacts--wrap li,.deckblatt .dk-contacts--wrap li span{white-space:normal;overflow-wrap:anywhere}
.deckblatt .dk-initials{display:grid;width:100%;height:100%;place-items:center;font-family:var(--heading-font);font-size:54pt;font-weight:800;color:var(--accent)}

.deckblatt--pastell .dk-shape{position:absolute;display:block}
.deckblatt--pastell .dk-sand{left:93mm;top:-12mm;width:214mm;height:214mm;border-radius:50%;background:var(--tint-sand)}
.deckblatt--pastell .dk-mint{left:0;top:112mm;width:111mm;height:111mm;border-radius:0 111mm 0 0;background:var(--tint-soft)}
.deckblatt .dk-dots{position:absolute;display:block;background-image:radial-gradient(circle at center,var(--tint-dots) 0 34%,transparent 37%);background-size:4.4mm 4.4mm}
.deckblatt .dk-dots--right{right:0;top:99mm;width:40mm;height:62mm;-webkit-mask-image:linear-gradient(to left,#000 10%,transparent);mask-image:linear-gradient(to left,#000 10%,transparent)}
.deckblatt .dk-dots--corner{left:16mm;top:14mm;width:30mm;height:30mm;-webkit-mask-image:linear-gradient(135deg,#000 15%,transparent 75%);mask-image:linear-gradient(135deg,#000 15%,transparent 75%)}
.deckblatt--pastell .dk-frame{position:absolute;left:52mm;top:20mm;width:107mm;height:107mm;border-radius:50% 0 50% 50%;background:var(--tint-strong)}
.deckblatt--pastell .dk-photo{position:absolute;left:5mm;bottom:5mm;width:97mm;height:97mm;overflow:hidden;border-radius:50%;background:var(--tint-faint)}
.deckblatt .dk-photo img,.deckblatt .dk-band-photo img{width:100%;height:100%;object-fit:cover}
.deckblatt--pastell .dk-identity{position:absolute;left:var(--doc-margin);top:140mm;width:98mm;height:76mm;display:flex;flex-direction:column;justify-content:flex-end}
.deckblatt .dk-name{font-weight:800;line-height:1.08;letter-spacing:.01em;text-transform:uppercase;color:var(--heading);overflow-wrap:anywhere}
.deckblatt .dk-name--normal{font-size:31pt}.deckblatt .dk-name--long{font-size:25pt}.deckblatt .dk-name--xlong{font-size:20pt}
.deckblatt--pastell .dk-title{margin-top:5mm;font-size:13pt;letter-spacing:.04em;line-height:1.25;color:var(--ink)}
.deckblatt--pastell .dk-lower{position:absolute;left:var(--doc-margin);right:var(--doc-margin);bottom:14mm;display:flex;flex-direction:column}
.deckblatt--pastell .dk-lower-grid{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:7mm;align-items:start}
.deckblatt--pastell .dk-subject{display:flex;flex-direction:column;gap:.6mm;margin-bottom:5mm;font-size:9pt;line-height:1.3;color:var(--muted)}
.deckblatt--pastell .dk-subject b{font-size:10pt;font-weight:700;color:var(--ink)}
.deckblatt--pastell .dk-subject span{font-size:9pt}
.deckblatt--pastell .dk-contacts li{gap:3mm;font-size:var(--dk-contact-size,10pt)}
.deckblatt--pastell .dk-contacts li i{flex-basis:5.6mm;width:5.6mm;height:5.6mm;color:var(--accent);background:var(--tint-soft)}
.deckblatt--pastell .dk-contacts--cols{grid-template-columns:max-content max-content;gap:2mm 7mm}
.deckblatt--pastell .dk-docs{min-width:0}
.deckblatt--pastell .dk-docs h3{display:flex;align-items:center;min-height:5.6mm;margin-bottom:1mm;font-size:10.5pt;font-weight:500;line-height:1.25;color:var(--ink)}
.deckblatt--pastell .dk-docs ul{display:grid;gap:.8mm}
.deckblatt--pastell .dk-docs--many ul{display:block;column-count:2;column-gap:5mm}
.deckblatt--pastell .dk-docs--many li{margin-bottom:.8mm;font-size:9pt;break-inside:avoid}
.deckblatt--pastell .dk-docs li{position:relative;padding-left:4.2mm;font-size:10.5pt;line-height:1.3;overflow-wrap:anywhere}
.deckblatt--pastell .dk-docs li:before{position:absolute;left:1mm;top:.55em;width:1.3mm;height:1.3mm;border-radius:50%;background:currentColor;content:""}

.deckblatt--akzentband{display:grid;grid-template-columns:fit-content(100mm) minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
.deckblatt--akzentband .dk-band{position:relative;min-width:70mm;padding:24mm 8mm 14mm;border-right:2.4mm solid var(--secondary);background:var(--accent);color:var(--on-accent)}
.deckblatt--akzentband .dk-band-photo{width:46mm;height:46mm;margin:0 auto;overflow:hidden;border:1.2mm solid color-mix(in srgb,var(--on-accent) 70%,transparent);border-radius:50%;background:color-mix(in srgb,var(--on-accent) 14%,transparent)}
.deckblatt--akzentband .dk-initials{color:var(--on-accent);font-size:34pt}
.deckblatt--akzentband .dk-band-contact{margin-top:16mm}
.deckblatt--akzentband .dk-band-contact h3{margin-bottom:3.4mm;padding-bottom:1.6mm;border-bottom:1px solid color-mix(in srgb,var(--on-accent) 45%,transparent);font-size:8.5pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.deckblatt--akzentband .dk-contacts,.deckblatt--akzentband .dk-contacts--grid{display:grid;grid-template-columns:minmax(0,1fr);gap:3mm}
.deckblatt--akzentband .dk-contacts li{align-items:flex-start;gap:2.6mm;font-size:var(--dk-contact-size,8pt)}
.deckblatt--akzentband .dk-contacts li i{flex-basis:4.4mm;width:4.4mm;height:4.4mm;border-radius:0;place-items:start center}
.deckblatt--akzentband .dk-contacts li i svg{width:13px;height:13px}
.deckblatt--akzentband .dk-main{position:relative;min-width:0;display:flex;flex-direction:column;margin:26mm var(--doc-margin) 16mm 18mm}
.deckblatt--akzentband .dk-kicker{font-size:9pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
.deckblatt--akzentband .dk-subject{margin-top:4mm;font-family:var(--heading-font);font-size:27pt;font-weight:var(--heading-weight);line-height:1.06;color:var(--heading)}
.deckblatt--akzentband .dk-meta{display:flex;flex-direction:column;gap:.8mm;margin-top:5mm;font-size:9.5pt;line-height:1.3;color:var(--muted)}
.deckblatt--akzentband .dk-meta span:first-child{font-size:12pt;color:var(--ink)}
.deckblatt--akzentband .dk-rule{display:block;height:1px;margin:14mm 0 11mm;background:var(--line)}
.deckblatt--akzentband .dk-name{font-size:21pt;color:var(--accent)}
.deckblatt--akzentband .dk-name--long{font-size:19pt}.deckblatt--akzentband .dk-name--xlong{font-size:16pt}
.deckblatt--akzentband .dk-title{margin-top:2mm;font-size:12pt;line-height:1.25;color:var(--ink)}
.deckblatt--akzentband .dk-statement{margin-top:6mm;line-height:1.45;text-align:justify;text-justify:inter-word;hyphens:auto}
.deckblatt--akzentband .dk-bottom{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:10mm;margin-top:auto;padding-top:6mm;border-top:1px solid var(--line)}
.deckblatt--akzentband .dk-bottom h3{margin-bottom:3mm;font-size:9.5pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.deckblatt--akzentband .dk-bottom ul{display:grid;gap:1.4mm}
.deckblatt--akzentband .dk-bottom li{font-size:9.5pt;overflow-wrap:anywhere}
.deckblatt--akzentband .dk-competencies{line-height:1.55}
.deckblatt--akzentband .dk-bottom--many{grid-template-columns:minmax(0,1fr);gap:6mm}
.deckblatt--akzentband .dk-bottom--many ul{display:block;column-count:2;column-gap:8mm}
.deckblatt--akzentband .dk-bottom--many li{margin-bottom:1.4mm;break-inside:avoid}
`;
