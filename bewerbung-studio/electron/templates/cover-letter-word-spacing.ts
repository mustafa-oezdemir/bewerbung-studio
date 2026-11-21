const paragraphPattern = /<w:p(?=[\s/>])[^>]*?(?:\/>|>[\s\S]*?<\/w:p>)/g;

const paragraphText = (paragraph: string) =>
  Array.from(
    paragraph.matchAll(/<w:t(?=[\s>])[^>]*>([\s\S]*?)<\/w:t>/g),
    (match) => match[1],
  ).join("");

const isSpacer = (paragraph: string) => {
  const content = paragraph
    .replace(/<w:(pPr|rPr)(?=[\s/>])[^>]*?(?:\/>|>[\s\S]*?<\/w:\1>)/g,
      (properties) => /<w:(?:sectPr|pStyle|pageBreakBefore|framePr|numPr|pPrChange)\b/.test(properties)
        ? properties
        : "")
    .replace(/<\/?w:(?:p|r|t)(?=[\s/>])[^>]*>/g, "");
  return !content.trim();
};

const isClosingGreeting = (text: string) =>
  /^(?:\{\{GRUSSFORMEL\}\}|Mit freundlichen Grüßen[,]?)$/i.test(text.trim());

const setParagraphProperty = (
  content: string,
  pattern: RegExp,
  property: string,
  successor: RegExp,
) => {
  if (pattern.test(content)) return content.replace(pattern, property);
  const index = content.search(successor);
  return index === -1 ? content + property : content.slice(0, index) + property + content.slice(index);
};

const formatBodyParagraph = (paragraph: string) => {
  const propertiesPattern = /^(<w:p(?=[\s>])[^>]*>\s*)(?:<w:pPr\b([^>]*?)(?:\/>|>([\s\S]*?)<\/w:pPr>))?/;
  return paragraph.replace(propertiesPattern, (_match, opening: string, attributes = "", content = "") => {
    const spacingPattern = /<w:spacing\b([^>]*?)(?:\/>|>\s*<\/w:spacing>)/;
    const spacingAttributes = (content.match(spacingPattern)?.[1] ?? "").replace(
      /\s+w:(?:before|after)(?:Lines|Autospacing)?\s*=\s*(?:"[^"]*"|'[^']*')/g,
      "",
    ).trimEnd();
    const spacing = `<w:spacing w:before="0" w:after="180"${spacingAttributes}/>`;
    const withSpacing = setParagraphProperty(
      content, spacingPattern, spacing,
      /<w:(?:ind|contextualSpacing|mirrorIndents|suppressOverlap|jc|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)\b/,
    );
    const withContextualSpacing = setParagraphProperty(
      withSpacing, /<w:contextualSpacing\b[^>]*(?:\/>|>\s*<\/w:contextualSpacing>)/,
      '<w:contextualSpacing w:val="0"/>',
      /<w:(?:mirrorIndents|suppressOverlap|jc|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)\b/,
    );
    const formatted = setParagraphProperty(
      withContextualSpacing, /<w:jc\b[^>]*(?:\/>|>\s*<\/w:jc>)/, '<w:jc w:val="both"/>',
      /<w:(?:textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)\b/,
    );
    return `${opening}<w:pPr${attributes}>${formatted}</w:pPr>`;
  });
};

export const formatWordCoverLetterBody = (
  xml: string,
  isBodyText: (text: string, index: number) => boolean,
) => {
  // Match only adjacent paragraphs in the same container when removing blank spacers.
  const paragraphs = Array.from(xml.matchAll(paragraphPattern), ({ 0: source, index: offset }, index) => {
    const text = paragraphText(source);
    return { offset, end: offset + source.length, text, body: isBodyText(text, index), spacer: !text.trim() && isSpacer(source) };
  });
  const spacersBeforeText = new Set<number>();
  let beforeBodyOrClosing = false;
  for (let index = paragraphs.length - 1; index >= 0; index--) {
    const current = paragraphs[index];
    const next = paragraphs[index + 1];
    if (current.spacer && next && beforeBodyOrClosing && !xml.slice(current.end, next.offset).trim()) {
      spacersBeforeText.add(index);
    }
    beforeBodyOrClosing = spacersBeforeText.has(index) || current.body || isClosingGreeting(current.text);
  }

  let index = 0;
  let afterBody = false;
  return xml.replace(paragraphPattern, (source) => {
    const current = paragraphs[index++];
    if (current.body) {
      afterBody = true;
      return formatBodyParagraph(source);
    }
    const previous = paragraphs[index - 2];
    if (afterBody && spacersBeforeText.has(index - 1) && !xml.slice(previous.end, current.offset).trim()) return "";
    afterBody = false;
    return source;
  });
};
