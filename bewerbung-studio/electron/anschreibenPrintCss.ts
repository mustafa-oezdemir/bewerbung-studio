import postcss from "postcss";
import { anschreibenPreviewRules } from "./anschreibenPreviewRules";

/**
 * The Anschreiben's PDF stylesheet is the preview's: every top-level rule of the app stylesheet (src/app.css) that
 * styles the preview's letter page (a selector naming one of its classes), so the PDF draws exactly what the preview
 * shows. Rules inside @media / @container (narrow windows, the app's own print view) never apply to the preview page
 * and are left out. The PDF prints the very markup of the preview (`renderAnschreibenMarkup`).
 *
 * The rules are kept in `anschreibenPreviewRules.ts`, generated from app.css; `anschreibenPrintCss.test.ts` fails as
 * soon as app.css changes them and rewrites the file with `UPDATE_ANSCHREIBEN_CSS=1`.
 */
const letterClass = /\.(?:document-paper|document-anschreiben|letter-(?:preview|header|rule|signature|attachments|subject|salutation|body|closing|compact|dense|gap-\d)|paper-(?:date|rule)|sender-(?:line|name|title|contact)|signature-(?:image|name))(?![\w-])/;

/** The preview letter rules of a stylesheet, in their order, each selector list limited to the letter's selectors. */
export const extractAnschreibenPreviewRules = (css: string) => {
  const rules: string[] = [];
  postcss.parse(css).each((node) => {
    if (node.type !== "rule") return;
    const selectors = postcss.list.comma(node.selector).map((selector) => selector.replace(/\s+/g, " ").trim())
      .filter((selector) => letterClass.test(selector));
    if (!selectors.length) return;
    const declarations = (node.nodes ?? [])
      .filter((child): child is postcss.Declaration => child.type === "decl")
      .map((declaration) => `${declaration.prop}:${declaration.value.replace(/\s+/g, " ").trim()}${declaration.important ? "!important" : ""}`);
    if (declarations.length) rules.push(`${selectors.join(",")}{${declarations.join(";")}}`);
  });
  return rules.join("\n");
};

/**
 * What the preview inherits from the app outside those rules (Tailwind's preflight, the global heading/paragraph rules,
 * the root's text rendering), limited to the letter page; and the PDF's own element rules (`p`, `h3`, …) undone there.
 * `:where()` keeps every selector at element specificity, so the letter rules always win as in the preview.
 */
const previewBaseCss = [
  ":where(.document-paper.document-anschreiben){font-size:16px;font-weight:400;line-height:1.5;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-text-size-adjust:100%;tab-size:4}",
  ":where(.document-paper.document-anschreiben),:where(.document-paper.document-anschreiben) *,:where(.document-paper.document-anschreiben) ::before,:where(.document-paper.document-anschreiben) ::after{box-sizing:border-box;margin:0;padding:0;border:0 solid}",
  ":where(.document-anschreiben) :is(h1,h2,h3,h4,h5,h6){margin:0;font-family:inherit;font-size:inherit;font-weight:inherit;line-height:inherit;color:inherit}",
  ":where(.document-anschreiben) :is(h1,h2,h3){letter-spacing:-.025em}",
  ":where(.document-anschreiben) :is(p,li){margin:0;font-size:inherit;line-height:inherit}",
  ":where(.document-anschreiben) :is(b,strong){font-weight:bolder}",
  ":where(.document-anschreiben) img{display:block;max-width:100%;height:auto;vertical-align:middle}",
  ":where(.document-anschreiben) :is(ul,ol){list-style:none}",
  ":where(.document-anschreiben) a{color:inherit;text-decoration:inherit}",
].join("");

/** The whole Anschreiben stylesheet of the PDF: the preview's base, then the preview's letter rules. */
export const anschreibenPrintCss = () => previewBaseCss + anschreibenPreviewRules;
