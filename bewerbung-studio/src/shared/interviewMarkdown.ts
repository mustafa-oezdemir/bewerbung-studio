import { safeExternalUrl } from "./safeExternalUrl";

/**
 * The Markdown of the interview notes as a tree the panel renders with React elements: headings, paragraphs,
 * emphasis, code, quotes, lists, rules, links and GitHub tables. Nothing is ever turned into HTML: raw HTML in the
 * text stays visible text, links only lead to http(s) addresses (see `safeExternalUrl`). Images are local files of the
 * interview folder (`Bilder/…`, loaded through the main process) or https addresses that are never loaded, only named.
 * A paragraph that is only an image (or a link to an image) is a figure; the short line after it is its caption, and
 * figures in a row form a gallery. Single line breaks stay line breaks, as typed.
 */

/** A downloaded image of the interview folder: `Bilder/<name>.<png|jpg|jpeg|gif|webp>`. */
export const localInterviewImagePattern = /^Bilder\/[\p{L}\p{N}][\p{L}\p{N}._-]{0,120}\.(?:png|jpe?g|gif|webp)$/u;

/**
 * An https address that points to an image: by its file extension or as an inline image of a chat answer
 * (`images.openai.com`, `?purpose=inline`). Only these link-only lines are taken for images.
 */
export const looksLikeImageUrl = (value: string) => {
  const href = safeExternalUrl(value);
  if (!href) return false;
  const url = new URL(href);
  return url.protocol === "https:" && (
    /\.(?:png|jpe?g|gif|webp)$/i.test(url.pathname) ||
    url.hostname === "images.openai.com" ||
    url.searchParams.get("purpose") === "inline");
};

/** A line that is only a link (as chat answers write images). */
export const wholeLineImageLink = /^([ \t]*)\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)[ \t]*$/;
/** `![alt](https://…)` with an optional title. */
export const imageReference = /!\[([^\]\n]*)\]\((https:\/\/[^\s)"]+)(?:[ \t]+"[^"\n]*")?\)/g;
export const interviewFenceLine = /^ {0,3}(`{3,}|~{3,})/;

export type ImageReference = { url: string; alt: string };

/** The image addresses of a text outside code blocks, in order, each once. */
export const remoteInterviewImages = (text: string): ImageReference[] => {
  const references = new Map<string, ImageReference>();
  let fence: string | null = null;
  for (const line of text.split("\n")) {
    const marker = interviewFenceLine.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    const link = wholeLineImageLink.exec(line);
    if (link && looksLikeImageUrl(link[3]) && !references.has(link[3])) references.set(link[3], { url: link[3], alt: link[2] });
    for (const image of line.matchAll(imageReference)) {
      if (!references.has(image[2])) references.set(image[2], { url: image[2], alt: image[1] });
    }
  }
  return [...references.values()];
};

export type MarkdownImage = { type: "image"; src: string; alt: string; title?: string };
export type MarkdownFigure = { image: MarkdownImage; caption?: MarkdownInline[] };

export type MarkdownInline =
  | { type: "text"; value: string }
  | { type: "break" }
  | { type: "code"; value: string }
  | { type: "strong" | "em" | "del"; children: MarkdownInline[] }
  | { type: "link"; href: string; children: MarkdownInline[] }
  | MarkdownImage;

export type TableAlignment = "left" | "center" | "right" | null;

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: MarkdownInline[] }
  | { type: "paragraph"; children: MarkdownInline[] }
  /** A paragraph that is only a quoted question („Was wissen Sie über uns?“): shown as a sub-heading. */
  | { type: "subquestion"; children: MarkdownInline[] }
  | { type: "code"; language: string; value: string }
  | { type: "blockquote"; children: MarkdownBlock[] }
  | { type: "list"; ordered: boolean; start: number; items: MarkdownBlock[][] }
  | { type: "rule" }
  | { type: "table"; align: TableAlignment[]; header: MarkdownInline[][]; rows: MarkdownInline[][][] }
  /** Images in a row, each with its caption, under an optional title line. */
  | { type: "gallery"; title?: MarkdownInline[]; items: MarkdownFigure[] };

const fenceOpen = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const headingLine = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const ruleLine = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const quoteLine = /^ {0,3}>[ \t]?/;
const listLine = /^( {0,12})([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
const tableDelimiter = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

const indentOf = (line: string) => line.match(/^[ \t]*/)![0].replace(/\t/g, "    ").length;

const blank = (line: string) => !line.trim();

/** Cells of a table row; `\|` is a literal pipe inside a cell. */
const splitRow = (line: string) => {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === "\\" && row[index + 1] === "|") {
      current += "|";
      index += 1;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else current += character;
  }
  cells.push(current.trim());
  return cells;
};

const isTableStart = (lines: readonly string[], index: number) =>
  index + 1 < lines.length && lines[index].includes("|") && tableDelimiter.test(lines[index + 1]) &&
  lines[index + 1].includes("-") &&
  splitRow(lines[index]).length === splitRow(lines[index + 1]).length;

/** A line that ends a paragraph and starts another block. */
const startsBlock = (lines: readonly string[], index: number) => {
  const line = lines[index];
  return fenceOpen.test(line) || headingLine.test(line) || ruleLine.test(line) || quoteLine.test(line) ||
    listLine.test(line) && Boolean(listLine.exec(line)![4].trim()) || isTableStart(lines, index);
};

/** The image a paragraph consists of: an image, or a single link to an image address (as chat answers write them). */
const standaloneImage = (block: MarkdownBlock | undefined): MarkdownImage | null => {
  if (block?.type !== "paragraph" || block.children.length !== 1) return null;
  const [only] = block.children;
  if (only.type === "image") return only;
  if (only.type === "link" && looksLikeImageUrl(only.href)) {
    return { type: "image", src: only.href, alt: plainText(only.children) };
  }
  return null;
};

const plainText = (nodes: readonly MarkdownInline[]): string => nodes.map((node) =>
  node.type === "text" || node.type === "code" ? node.value
    : node.type === "break" ? " "
      : node.type === "image" ? node.alt : plainText(node.children)).join("");

type ParagraphBlock = Extract<MarkdownBlock, { type: "paragraph" }>;

/** One short line of plain text (no link, image or line break): a caption or a gallery title. */
const shortLine = (block: MarkdownBlock | undefined): block is ParagraphBlock =>
  block?.type === "paragraph" && block.children.every((node) => !["break", "link", "image"].includes(node.type)) &&
  plainText(block.children).trim().length > 0 && plainText(block.children).length <= 90;

/** Figures (image + caption) in a row become one gallery; a short title line right before two or more is its title. */
const groupGalleries = (blocks: readonly MarkdownBlock[]) => {
  const result: MarkdownBlock[] = [];
  let index = 0;
  while (index < blocks.length) {
    if (!standaloneImage(blocks[index])) {
      result.push(blocks[index]);
      index += 1;
      continue;
    }
    const items: MarkdownFigure[] = [];
    for (let image = standaloneImage(blocks[index]); image; image = standaloneImage(blocks[index])) {
      const figure: MarkdownFigure = { image };
      const next = blocks[index + 1];
      if (shortLine(next)) {
        figure.caption = next.children;
        index += 1;
      }
      items.push(figure);
      index += 1;
    }
    const previous = result.at(-1);
    const title = items.length > 1 && shortLine(previous) && !/[.:!?]\s*$/.test(plainText(previous.children))
      ? (result.pop() as ParagraphBlock).children
      : undefined;
    result.push({ type: "gallery", ...(title ? { title } : {}), items });
  }
  return result;
};

export const parseMarkdownBlocks = (text: string): MarkdownBlock[] => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return parseLines(lines);
};

const parseLines = (lines: readonly string[]): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (blank(line)) {
      index += 1;
      continue;
    }

    const fence = fenceOpen.exec(line);
    if (fence) {
      const marker = fence[1];
      const content: string[] = [];
      index += 1;
      while (index < lines.length) {
        const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lines[index]);
        if (closing && closing[1][0] === marker[0] && closing[1].length >= marker.length) {
          index += 1;
          break;
        }
        content.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", language: fence[2] ?? "", value: content.join("\n") });
      continue;
    }

    const heading = headingLine.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(heading[2] ?? ""),
      });
      index += 1;
      continue;
    }

    if (ruleLine.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (quoteLine.test(line)) {
      const content: string[] = [];
      while (index < lines.length && !blank(lines[index]) &&
          (quoteLine.test(lines[index]) || !startsBlock(lines, index))) {
        content.push(lines[index].replace(quoteLine, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", children: parseLines(content) });
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = splitRow(line);
      const align = splitRow(lines[index + 1]).map((cell): TableAlignment =>
        cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : null);
      index += 2;
      const rows: MarkdownInline[][][] = [];
      while (index < lines.length && !blank(lines[index]) && lines[index].includes("|")) {
        const cells = splitRow(lines[index]);
        rows.push(header.map((_, column) => parseInline(cells[column] ?? "")));
        index += 1;
      }
      blocks.push({ type: "table", align, header: header.map((cell) => parseInline(cell)), rows });
      continue;
    }

    const item = listLine.exec(line);
    if (item && item[4].trim()) {
      const [list, next] = parseList(lines, index);
      blocks.push(list);
      index = next;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && !blank(lines[index]) && (paragraph.length === 0 || !startsBlock(lines, index))) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({
      type: paragraph.length === 1 && quotedQuestion.test(paragraph[0]) ? "subquestion" : "paragraph",
      children: parseInline(paragraph.join("\n")),
    });
  }
  return groupGalleries(blocks);
};

/** One line in quotes that ends with a question mark: „…?“, "…?", »…?«, ‚…?‘ (the text stays as written). */
const quotedQuestion = /^(?:„[^„“\n]{2,240}\?“|"[^"\n]{2,240}\?"|»[^»«\n]{2,240}\?«|«[^»«\n]{2,240}\?»|‚[^‚‘\n]{2,240}\?‘|“[^“”\n]{2,240}\?”)$/u;

const parseList = (lines: readonly string[], start: number): [MarkdownBlock, number] => {
  const first = listLine.exec(lines[start])!;
  const ordered = /\d/.test(first[2]);
  const baseIndent = indentOf(lines[start]);
  const items: string[][] = [];
  let contentIndent = 0;
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    const marker = listLine.exec(line);
    const indent = indentOf(line);
    if (marker && marker[4].trim() && indent < baseIndent + 2 && /\d/.test(marker[2]) === ordered) {
      contentIndent = indent + marker[2].length + Math.min(Math.max(marker[3].length, 1), 4);
      items.push([marker[4]]);
      index += 1;
      continue;
    }
    if (blank(line)) {
      // A blank line continues the list only when indented content or the next item follows.
      let next = index + 1;
      while (next < lines.length && blank(lines[next])) next += 1;
      const following = lines[next];
      const followingMarker = following !== undefined ? listLine.exec(following) : null;
      if (following === undefined ||
          !(indentOf(following) >= contentIndent ||
            (followingMarker && indentOf(following) < baseIndent + 2 && /\d/.test(followingMarker[2]) === ordered))) break;
      items.at(-1)!.push("");
      index += 1;
      continue;
    }
    if (indent >= contentIndent) {
      items.at(-1)!.push(line.replace(/\t/g, "    ").slice(contentIndent));
      index += 1;
      continue;
    }
    // A lazy continuation line of the item's paragraph.
    const previous = items.at(-1)!.at(-1);
    if (previous && !blank(previous) && !startsBlock(lines, index)) {
      items.at(-1)!.push(line.trim());
      index += 1;
      continue;
    }
    break;
  }
  return [{
    type: "list",
    ordered,
    start: ordered ? Number(/\d+/.exec(first[2])![0]) : 1,
    items: items.map((item) => parseLines(item)),
  }, index];
};

const punctuation = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;
const bareUrl = /^https?:\/\/[^\s<>"]*[^\s<>".,:;!?)\]'"]/;

/** Inline formatting of one paragraph, heading or table cell. */
export const parseInline = (text: string): MarkdownInline[] => {
  const result: MarkdownInline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) result.push({ type: "text", value: buffer });
    buffer = "";
  };
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    const rest = text.slice(index);

    if (character === "\\" && index + 1 < text.length) {
      if (text[index + 1] === "\n") {
        flush();
        result.push({ type: "break" });
        index += 2;
        continue;
      }
      if (punctuation.test(text[index + 1])) {
        buffer += text[index + 1];
        index += 2;
        continue;
      }
    }
    if (character === "\n") {
      buffer = buffer.replace(/ +$/, "");
      flush();
      result.push({ type: "break" });
      index += 1;
      continue;
    }
    if (character === "`") {
      const run = /^`+/.exec(rest)![0];
      const end = text.indexOf(run, index + run.length);
      if (end !== -1) {
        flush();
        let code = text.slice(index + run.length, end).replace(/\n/g, " ");
        if (/^ .* $/.test(code) && code.trim()) code = code.slice(1, -1);
        result.push({ type: "code", value: code });
        index = end + run.length;
        continue;
      }
      buffer += run;
      index += run.length;
      continue;
    }
    if (character === "[" || (character === "!" && text[index + 1] === "[")) {
      const link = matchLink(text, character === "!" ? index + 1 : index);
      if (link && character === "!") {
        // An image: a downloaded file of the interview folder or an https address (named, never loaded).
        const local = localInterviewImagePattern.test(link.destination);
        const remote = safeExternalUrl(link.destination);
        if (local || remote?.startsWith("https:")) {
          flush();
          result.push({
            type: "image",
            src: local ? link.destination : remote!,
            alt: link.label,
            ...(link.title ? { title: link.title } : {}),
          });
          index = link.end;
          continue;
        }
      }
      if (link) {
        flush();
        const href = safeExternalUrl(link.destination);
        const label = parseInline(link.label || link.destination);
        if (href) result.push({ type: "link", href, children: label });
        else result.push(...withDestination(label, link.destination));
        index = link.end;
        continue;
      }
    }
    if (character === "<") {
      const autolink = /^<(https?:\/\/[^\s<>]+)>/.exec(rest);
      if (autolink) {
        flush();
        const href = safeExternalUrl(autolink[1]);
        result.push(href ? { type: "link", href, children: [{ type: "text", value: autolink[1] }] } : { type: "text", value: autolink[0] });
        index += autolink[0].length;
        continue;
      }
    }
    if (character === "h" && (index === 0 || !/[\p{L}\p{N}]/u.test(text[index - 1]))) {
      const url = bareUrl.exec(rest);
      const href = url ? safeExternalUrl(url[0]) : null;
      if (url && href) {
        flush();
        result.push({ type: "link", href, children: [{ type: "text", value: url[0] }] });
        index += url[0].length;
        continue;
      }
    }
    if (character === "*" || character === "_" || (character === "~" && text[index + 1] === "~")) {
      const emphasis = matchEmphasis(text, index);
      if (emphasis) {
        flush();
        result.push(emphasis.node);
        index = emphasis.end;
        continue;
      }
    }
    buffer += character;
    index += 1;
  }
  flush();
  return result;
};

/** An unsafe or relative link target stays visible as text next to its label: nothing is dropped. */
const withDestination = (label: MarkdownInline[], destination: string): MarkdownInline[] =>
  [...label, { type: "text", value: ` (${destination})` }];

const matchLink = (text: string, open: number) => {
  let depth = 0;
  let close = -1;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "\\") { index += 1; continue; }
    if (text[index] === "[") depth += 1;
    if (text[index] === "]") {
      depth -= 1;
      if (depth === 0) { close = index; break; }
    }
  }
  if (close === -1 || text[close + 1] !== "(") return null;
  const target = /^\(\s*(<[^>\n]*>|[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)/.exec(text.slice(close + 1));
  if (!target) return null;
  return {
    label: text.slice(open + 1, close),
    destination: target[1].replace(/^<|>$/g, ""),
    title: target[2] ?? target[3],
    end: close + 1 + target[0].length,
  };
};

const matchEmphasis = (text: string, index: number): { node: MarkdownInline; end: number } | null => {
  const character = text[index];
  const run = new RegExp(`^\\${character}+`).exec(text.slice(index))![0];
  // "_" inside a word (snake_case) is no emphasis.
  if (character === "_" && index > 0 && /[\p{L}\p{N}]/u.test(text[index - 1])) return null;
  const opening = character === "~" ? 2 : Math.min(run.length, 3);
  if (character === "~" && run.length !== 2) return null;
  const after = text[index + opening];
  if (after === undefined || /\s/.test(after)) return null;
  const delimiter = character.repeat(opening);
  let search = index + opening;
  while (search < text.length) {
    const end = text.indexOf(delimiter, search);
    if (end === -1) return null;
    const closingRun = new RegExp(`^\\${character}+`).exec(text.slice(end))![0];
    const before = text[end - 1];
    const following = text[end + closingRun.length];
    const closes = !/\s/.test(before) && end > index + opening &&
      (character !== "_" || following === undefined || !/[\p{L}\p{N}]/u.test(following)) &&
      // "**a** and *b*": a single "*" must not close on a "**".
      (opening !== 1 || closingRun.length === 1 || closingRun.length === 3);
    if (closes) {
      const inner = parseInline(text.slice(index + opening, end));
      const node: MarkdownInline = character === "~"
        ? { type: "del", children: inner }
        : opening === 3
          ? { type: "strong", children: [{ type: "em", children: inner }] }
          : { type: opening === 2 ? "strong" : "em", children: inner };
      return { node, end: end + opening };
    }
    search = end + closingRun.length;
  }
  return null;
};
