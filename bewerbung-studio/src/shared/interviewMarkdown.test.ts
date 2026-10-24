import { describe, expect, it } from "vitest";
import { looksLikeImageUrl, parseInline, parseMarkdownBlocks, remoteInterviewImages } from "./interviewMarkdown";

const text = (value: string) => ({ type: "text", value });

describe("parseMarkdownBlocks", () => {
  it("reads headings H1–H6, paragraphs with kept line breaks and rules", () => {
    expect(parseMarkdownBlocks("# Titel\n## Zwei\n###### Sechs\n\nErste Zeile,\nzweite Zeile.\n\n---\n#kein Titel")).toEqual([
      { type: "heading", level: 1, children: [text("Titel")] },
      { type: "heading", level: 2, children: [text("Zwei")] },
      { type: "heading", level: 6, children: [text("Sechs")] },
      { type: "paragraph", children: [text("Erste Zeile,"), { type: "break" }, text("zweite Zeile.")] },
      { type: "rule" },
      { type: "paragraph", children: [text("#kein Titel")] },
    ]);
  });

  it("reads nested and ordered lists, quotes and fenced code", () => {
    const blocks = parseMarkdownBlocks([
      "- Erster Punkt",
      "  - Unterpunkt",
      "- Zweiter Punkt",
      "",
      "3. Drei",
      "4. Vier",
      "",
      "> Zitat **wichtig**",
      "> zweite Zeile",
      "",
      "```ts",
      "const ä = '<b>';",
      "- kein Listenpunkt",
      "```",
    ].join("\n"));
    expect(blocks).toEqual([
      {
        type: "list", ordered: false, start: 1, items: [
          [
            { type: "paragraph", children: [text("Erster Punkt")] },
            { type: "list", ordered: false, start: 1, items: [[{ type: "paragraph", children: [text("Unterpunkt")] }]] },
          ],
          [{ type: "paragraph", children: [text("Zweiter Punkt")] }],
        ],
      },
      {
        type: "list", ordered: true, start: 3, items: [
          [{ type: "paragraph", children: [text("Drei")] }],
          [{ type: "paragraph", children: [text("Vier")] }],
        ],
      },
      {
        type: "blockquote", children: [{
          type: "paragraph",
          children: [text("Zitat "), { type: "strong", children: [text("wichtig")] }, { type: "break" }, text("zweite Zeile")],
        }],
      },
      { type: "code", language: "ts", value: "const ä = '<b>';\n- kein Listenpunkt" },
    ]);
  });

  it("shows a paragraph that is only a quoted question as a sub-question", () => {
    expect(parseMarkdownBlocks("„Was wissen Sie über unser Unternehmen?“\n\n„Ich habe mich informiert.“\n\n„Frage?“ und mehr\n\n\"Warum Seidel?\"")).toEqual([
      { type: "subquestion", children: [text("„Was wissen Sie über unser Unternehmen?“")] },
      { type: "paragraph", children: [text("„Ich habe mich informiert.“")] },
      { type: "paragraph", children: [text("„Frage?“ und mehr")] },
      { type: "subquestion", children: [text("\"Warum Seidel?\"")] },
    ]);
  });

  it("turns image lines with captions into a titled gallery, as chat answers write them", () => {
    const remote = "https://images.openai.com/static-rsc-4/abc?purpose=inline";
    const blocks = parseMarkdownBlocks([
      "Typische Schutzkleidung in der Pharmaproduktion", "",
      `[GammaGuard Coveralls](${remote})`, "", "Schutzkittel", "",
      '![Haarnetz Foto](Bilder/Haarnetz_0123456789.jpg "Quelle: https://example.com/h.jpg")', "", "Haarnetz", "",
      "[Normale Seite](https://example.com/seite)", "", "Danach Text.",
    ].join("\n"));
    expect(blocks).toEqual([
      {
        type: "gallery",
        title: [text("Typische Schutzkleidung in der Pharmaproduktion")],
        items: [
          { image: { type: "image", src: remote, alt: "GammaGuard Coveralls" }, caption: [text("Schutzkittel")] },
          {
            image: { type: "image", src: "Bilder/Haarnetz_0123456789.jpg", alt: "Haarnetz Foto", title: "Quelle: https://example.com/h.jpg" },
            caption: [text("Haarnetz")],
          },
        ],
      },
      // A link to a page is no image.
      { type: "paragraph", children: [{ type: "link", href: "https://example.com/seite", children: [text("Normale Seite")] }] },
      { type: "paragraph", children: [text("Danach Text.")] },
    ]);
  });

  it("never takes other image sources and finds the remote images to download", () => {
    expect(parseInline("![x](../geheim.png) ![y](file:///C:/a.png) ![z](http://example.com/a.png)")).toEqual([
      text("x"), text(" (../geheim.png)"), text(" "),
      text("y"), text(" (file:///C:/a.png)"), text(" "),
      { type: "link", href: "http://example.com/a.png", children: [text("z")] },
    ]);
    expect(remoteInterviewImages([
      "[Bild](https://images.openai.com/x?purpose=inline)",
      "Text mit ![Foto](https://cdn.example.com/foto.webp) im Satz",
      "[Seite](https://example.com/seite)",
      "```",
      "[Code](https://images.openai.com/code)",
      "```",
      "![lokal](Bilder/lokal_0123456789.png)",
    ].join("\n"))).toEqual([
      { url: "https://images.openai.com/x?purpose=inline", alt: "Bild" },
      { url: "https://cdn.example.com/foto.webp", alt: "Foto" },
    ]);
    expect(looksLikeImageUrl("https://example.com/bild.JPG")).toBe(true);
    expect(looksLikeImageUrl("http://example.com/bild.jpg")).toBe(false);
    expect(looksLikeImageUrl("https://example.com/seite")).toBe(false);
  });

  it("reads GitHub tables with alignment, escaped pipes and missing cells", () => {
    expect(parseMarkdownBlocks("| Stärke | Beispiel | Wert |\n|:--|:-:|--:|\n| Analyse | A \\| B | **hoch** |\n| Teamarbeit |")).toEqual([{
      type: "table",
      align: ["left", "center", "right"],
      header: [[text("Stärke")], [text("Beispiel")], [text("Wert")]],
      rows: [
        [[text("Analyse")], [text("A | B")], [{ type: "strong", children: [text("hoch")] }]],
        [[text("Teamarbeit")], [], []],
      ],
    }]);
  });
});

describe("parseInline", () => {
  it("reads strong, em, strike-through and inline code", () => {
    expect(parseInline("**fett** und *kursiv*, ***beides***, ~~alt~~ und `npm run <test>`")).toEqual([
      { type: "strong", children: [text("fett")] },
      text(" und "),
      { type: "em", children: [text("kursiv")] },
      text(", "),
      { type: "strong", children: [{ type: "em", children: [text("beides")] }] },
      text(", "),
      { type: "del", children: [text("alt")] },
      text(" und "),
      { type: "code", value: "npm run <test>" },
    ]);
  });

  it("does not treat snake_case, spaced stars or escapes as emphasis", () => {
    expect(parseInline("datei_name_neu, 5 * 3 * 2, \\*kein\\*")).toEqual([text("datei_name_neu, 5 * 3 * 2, *kein*")]);
  });

  it("links only http(s) addresses and keeps other targets visible as text", () => {
    expect(parseInline("[Firma](https://example.com/über) und <https://example.org> oder https://example.net/a.")).toEqual([
      { type: "link", href: "https://example.com/%C3%BCber", children: [text("Firma")] },
      text(" und "),
      { type: "link", href: "https://example.org/", children: [text("https://example.org")] },
      text(" oder "),
      { type: "link", href: "https://example.net/a", children: [text("https://example.net/a")] },
      text("."),
    ]);
    expect(parseInline("[Klick](javascript:alert(1)) [Datei](file:///C:/x) [Login](https://user:pw@example.com)")).toEqual([
      text("Klick"), text(" (javascript:alert(1))"), text(" "),
      text("Datei"), text(" (file:///C:/x)"), text(" "),
      text("Login"), text(" (https://user:pw@example.com)"),
    ]);
  });

  it("keeps raw HTML as text", () => {
    expect(parseInline("<script>alert(1)</script> <img src=x onerror=alert(2)>")).toEqual([
      text("<script>alert(1)</script> <img src=x onerror=alert(2)>"),
    ]);
  });
});
