import { copyFile, readFile, writeFile } from "../security/secure-fs";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import {
  einspaltigLebenslaufTemplateConfig,
  gepflegtLebenslaufTemplateConfig,
  ivyLeagueLebenslaufTemplateConfig,
  klassischLebenslaufTemplateConfig,
  kompaktLebenslaufTemplateConfig,
  kreativLebenslaufTemplateConfig,
  stilvollLebenslaufTemplateConfig,
  templatePlaceholderAliases,
  templatePlaceholderKeys,
  zeitgenoessischLebenslaufTemplateConfig,
} from "../../src/features/templates/template.constants";
import type {
  CreatedDocumentResult,
  DocumentTemplate,
} from "../../src/features/templates/template.types";
import { TemplateError, toTemplateError } from "../../src/features/templates/template.errors";

const profilePhotoDataUrl =
  /^data:image\/png;base64,([a-z0-9+/=\s]+)$/i;

const decodeXmlText = (value: string) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");

const escapeXmlText = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const appendCoverLetterAttachments = (
  zip: PizZip,
  attachmentNote: string,
  accentColor: string,
) => {
  const documentPart = zip.file("word/document.xml");
  if (!documentPart || !attachmentNote.trim()) return;
  const lines = attachmentNote
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return;
  const paragraphs = lines
    .map(
      (line, index) =>
        `<w:p><w:pPr><w:spacing w:before="${index === 0 ? 180 : 0}" w:after="0" w:line="230" w:lineRule="auto"/><w:keepNext/></w:pPr><w:r><w:rPr>${index === 0 ? `<w:b/><w:color w:val="${accentColor}"/>` : ""}<w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXmlText(line)}</w:t></w:r></w:p>`,
    )
    .join("");
  zip.file(
    "word/document.xml",
    documentPart.asText().replace("<w:sectPr", `${paragraphs}<w:sectPr`),
  );
};

const removeEmptyParagraphs = (documentXml: string) =>
  documentXml.replace(
    /<w:p\b[\s\S]*?<\/w:p>/g,
    (paragraph) => {
      if (
        paragraph.includes('w:pStyle w:val="CellTerminator"') ||
        paragraph.includes("<w:drawing")
      ) {
        return paragraph;
      }
      const text = Array.from(
        paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
        (match) => decodeXmlText(match[1]).trim(),
      ).join("");
      return text ? paragraph : "";
    },
  );

const justifiedCoverLetterPlaceholderKeys = new Set([
  "EINLEITUNG",
  "MOTIVATION",
  "FACHLICHE_EIGNUNG",
  "UNTERNEHMENSBEZUG",
  "ZUSATZABSATZ",
  "HAUPTTEXT",
  "SCHLUSSTEXT",
  "ANSCHREIBEN_METNI",
  "EK_PARAGRAF",
  "KAPANIS",
]);

const applyCoverLetterJustification = (zip: PizZip) => {
  const documentPart = zip.file("word/document.xml");
  if (!documentPart) return;

  const documentXml = documentPart.asText().replace(
    /<w:p\b[\s\S]*?<\/w:p>/g,
    (paragraph) => {
      const paragraphText = Array.from(
        paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
        (match) => decodeXmlText(match[1]),
      ).join("");
      const placeholderKeys = Array.from(
        paragraphText.matchAll(/\{\{([A-Z0-9_]+)\}\}/g),
        (match) => match[1],
      );
      const isBodyParagraph = placeholderKeys.some((key) =>
        justifiedCoverLetterPlaceholderKeys.has(key),
      );
      if (!isBodyParagraph) {
        return paragraph;
      }

      const justification = '<w:jc w:val="both"/>';
      let updatedParagraph = paragraph;
      if (/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/.test(updatedParagraph)) {
        updatedParagraph = updatedParagraph.replace(
          /<w:pPr\b([^>]*)>([\s\S]*?)<\/w:pPr>/,
          (_properties, attributes: string, content: string) => {
            const updatedContent = /<w:jc\b[^>]*(?:\/>|>[\s\S]*?<\/w:jc>)/.test(
              content,
            )
              ? content.replace(
                  /<w:jc\b[^>]*(?:\/>|>[\s\S]*?<\/w:jc>)/,
                  justification,
                )
              : `${content}${justification}`;
            return `<w:pPr${attributes}>${updatedContent}</w:pPr>`;
          },
        );
      } else if (/<w:pPr\b[^>]*\/>/.test(updatedParagraph)) {
        updatedParagraph = updatedParagraph.replace(
          /<w:pPr\b([^>]*)\/>/,
          `<w:pPr$1>${justification}</w:pPr>`,
        );
      } else {
        updatedParagraph = updatedParagraph.replace(
          /^(<w:p\b[^>]*>)/,
          `$1<w:pPr>${justification}</w:pPr>`,
        );
      }
      return updatedParagraph;
    },
  );
  zip.file("word/document.xml", documentXml);
};

const cleanKlassischDocumentXml = (documentXml: string) => {
  const tableRanges: Array<{ start: number; end: number }> = [];
  const stack: number[] = [];
  for (const match of documentXml.matchAll(/<\/?w:tbl\b[^>]*>/g)) {
    if (match[0].startsWith("</")) {
      const start = stack.pop();
      if (start !== undefined) {
        tableRanges.push({ start, end: match.index + match[0].length });
      }
    } else if (!match[0].endsWith("/>")) {
      stack.push(match.index);
    }
  }
  const emptyTables = tableRanges.filter(({ start, end }) => {
    const table = documentXml.slice(start, end);
    if (table.includes("<w:drawing")) return false;
    const text = Array.from(
      table.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
      (match) => decodeXmlText(match[1]).trim(),
    ).join("");
    return !text;
  });
  const emptyParagraphs = Array.from(
    documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g),
    (match) => {
      const paragraph = match[0];
      const start = match.index;
      const end = start + paragraph.length;
      const text = Array.from(
        paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
        (textMatch) => decodeXmlText(textMatch[1]).trim(),
      ).join("");
      const insideTable = tableRanges.some(
        (range) => range.start < start && range.end > end,
      );
      const removable =
        !text &&
        !paragraph.includes("<w:drawing") &&
        (!insideTable || paragraph.includes('w:pStyle w:val="ListBullet"'));
      return removable ? { start, end } : null;
    },
  ).filter((range): range is { start: number; end: number } => Boolean(range));
  const removals = [...emptyTables, ...emptyParagraphs].filter(
    (candidate, _, all) =>
      !all.some(
        (other) =>
          other.start < candidate.start && other.end > candidate.end,
      ),
  );
  return removals
    .sort((left, right) => right.start - left.start)
    .reduce(
      (xml, range) => xml.slice(0, range.start) + xml.slice(range.end),
      documentXml,
    );
};

const centeredSquareCrop = (bytes: Buffer) => {
  if (
    bytes.length < 24 ||
    bytes.toString("ascii", 1, 4) !== "PNG"
  ) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height || width === height) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }
  if (width > height) {
    const crop = Math.round(((width - height) / (2 * width)) * 100_000);
    return { left: crop, top: 0, right: crop, bottom: 0 };
  }
  const crop = Math.round(((height - width) / (2 * height)) * 100_000);
  return { left: 0, top: crop, right: 0, bottom: crop };
};

const normalizedHex = (value: string | undefined, fallback: string) => {
  const candidate = value?.replace("#", "").toUpperCase();
  return candidate && /^[0-9A-F]{6}$/.test(candidate)
    ? candidate
    : fallback;
};

const applyManagedResumeDesignTokens = (
  templateId: string,
  zip: PizZip,
  data: Record<string, string>,
) => {
  const replacements =
    templateId === ivyLeagueLebenslaufTemplateConfig.id
      ? new Map([
          [
            "073C8C",
            normalizedHex(data.DESIGN_PRIMARY, "073C8C"),
          ],
          [
            "FF6A00",
            normalizedHex(data.DESIGN_ACCENT, "FF6A00"),
          ],
        ])
      : templateId === kompaktLebenslaufTemplateConfig.id
      ? new Map([
          [
            "0A3485",
            normalizedHex(data.DESIGN_PRIMARY, "0A3485"),
          ],
          [
            "FF6500",
            normalizedHex(data.DESIGN_ACCENT, "FF6500"),
          ],
          [
            "FFD8BF",
            normalizedHex(data.DESIGN_SOFT_ACCENT, "FFD8BF"),
          ],
        ])
      : templateId === stilvollLebenslaufTemplateConfig.id
        ? new Map([
            [
              "36B873",
              normalizedHex(data.DESIGN_PRIMARY, "36B873"),
            ],
            [
              "075E50",
              normalizedHex(data.DESIGN_ACCENT, "075E50"),
            ],
            [
              "D9F2E5",
              normalizedHex(data.DESIGN_SOFT_ACCENT, "D9F2E5"),
            ],
          ])
        : templateId === einspaltigLebenslaufTemplateConfig.id
          ? new Map([
              [
                "073B8F",
                normalizedHex(data.DESIGN_PRIMARY, "0B3485"),
              ],
              [
                "4AA7F5",
                normalizedHex(data.DESIGN_ACCENT, "4AAAF4"),
              ],
              [
                "EAF6FD",
                normalizedHex(data.DESIGN_SOFT_ACCENT, "EAF5FD"),
              ],
            ])
          : templateId === klassischLebenslaufTemplateConfig.id
            ? new Map([
                [
                  "2B2F32",
                  normalizedHex(data.DESIGN_PRIMARY, "2B2F32"),
                ],
                [
                  "00AFC5",
                  normalizedHex(data.DESIGN_ACCENT, "00AFC5"),
                ],
                [
                  "CDEFF3",
                  normalizedHex(data.DESIGN_SOFT_ACCENT, "CDEFF3"),
                ],
              ])
      : templateId === kreativLebenslaufTemplateConfig.id
      ? new Map([
          [
            "154F45",
            normalizedHex(data.DESIGN_PRIMARY, "154F45"),
          ],
          [
            "39B774",
            normalizedHex(data.DESIGN_PRIMARY, "39B774"),
          ],
          [
            "E4EBE8",
            normalizedHex(data.DESIGN_SOFT_ACCENT, "E4EBE8"),
          ],
        ])
      : new Map([
          [
            "0F5B4A",
            normalizedHex(data.DESIGN_PRIMARY, "0F5B4A"),
          ],
          [
            "36B779",
            normalizedHex(data.DESIGN_ACCENT, "36B779"),
          ],
          [
            "CDEEDF",
            normalizedHex(data.DESIGN_SOFT_ACCENT, "CDEEDF"),
          ],
          [
            "9DDBB9",
            normalizedHex(
              data.DESIGN_TITLE_BACKGROUND,
              "9DDBB9",
            ),
          ],
        ]);
  const font = data.DESIGN_FONT?.trim() || "Arial";
  for (const fileName of Object.keys(zip.files)) {
    if (!/^word\/.*\.xml$/i.test(fileName)) continue;
    const part = zip.file(fileName);
    if (!part) continue;
    let xml = part.asText();
    for (const [source, target] of replacements) {
      xml = xml.replaceAll(source, target);
    }
    xml = xml
      .replaceAll('w:ascii="Arial"', `w:ascii="${font}"`)
      .replaceAll('w:hAnsi="Arial"', `w:hAnsi="${font}"`)
      .replaceAll('w:cs="Arial"', `w:cs="${font}"`);
    zip.file(fileName, xml);
  }
};

const escapeXmlAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const compactHyperlinkTarget = (value: string) => {
  const text = value.trim();
  if (!text) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    return `mailto:${text}`;
  }
  if (/^\+?[\d\s()./-]{7,}$/.test(text)) {
    return `tel:${text.replace(/[^\d+]/g, "")}`;
  }
  if (/^https?:\/\//i.test(text)) return text;
  if (
    /^(?:www\.|linkedin\.com\/|github\.com\/|[\w.-]+\.[a-z]{2,}(?:\/|$))/i.test(
      text,
    )
  ) {
    return `https://${text}`;
  }
  return null;
};

const applyManagedHyperlinkTargets = (
  zip: PizZip,
  data: Record<string, string>,
) => {
  for (const fileName of Object.keys(zip.files)) {
    if (!/^word\/_rels\/.*\.rels$/i.test(fileName)) continue;
    const part = zip.file(fileName);
    if (!part) continue;
    const relationshipsXml = part.asText().replace(
      /Target="([^"]*(?:\{\{|%7B%7B)[A-Z0-9_]+(?:\}\}|%7D%7D)[^"]*)"/gi,
      (attribute, encodedTarget: string) => {
        let decodedTarget = encodedTarget;
        try {
          decodedTarget = decodeURIComponent(encodedTarget);
        } catch {
          // Keep the original relationship target when it is not URL encoded.
        }
        const key = decodedTarget.match(/\{\{([A-Z0-9_]+)\}\}/i)?.[1];
        if (!key) return attribute;
        const target = compactHyperlinkTarget(data[key] ?? "");
        return target
          ? `Target="${escapeXmlAttribute(target)}"`
          : 'Target="about:blank"';
      },
    );
    zip.file(fileName, relationshipsXml);
  }
};

const applyKompaktDocumentOptions = (
  zip: PizZip,
  data: Record<string, string>,
) => {
  const documentPart = zip.file("word/document.xml");
  const relationshipsPart = zip.file(
    "word/_rels/document.xml.rels",
  );
  if (!documentPart || !relationshipsPart) return;
  let documentXml = documentPart.asText();
  let relationshipsXml = relationshipsPart.asText();

  const verticalMm = Number(data.DESIGN_MARGIN_VERTICAL_MM);
  const horizontalMm = Number(data.DESIGN_MARGIN_HORIZONTAL_MM);
  if (
    Number.isFinite(verticalMm) &&
    verticalMm >= 10 &&
    verticalMm <= 25 &&
    Number.isFinite(horizontalMm) &&
    horizontalMm >= 13 &&
    horizontalMm <= 25
  ) {
    const verticalDxa = Math.round((verticalMm / 25.4) * 1_440);
    const horizontalDxa = Math.round(
      (horizontalMm / 25.4) * 1_440,
    );
    documentXml = documentXml.replace(
      /<w:pgMar\b[^>]*\/>/,
      (pageMargins) =>
        pageMargins
          .replace(/w:top="[^"]*"/, `w:top="${verticalDxa}"`)
          .replace(/w:bottom="[^"]*"/, `w:bottom="${verticalDxa}"`)
          .replace(/w:left="[^"]*"/, `w:left="${horizontalDxa}"`)
          .replace(/w:right="[^"]*"/, `w:right="${horizontalDxa}"`),
    );
  }

  if (data.DEKORATION_AKTIV?.trim().toLowerCase() === "false") {
    const decoration = documentXml
      .match(/<w:drawing>[\s\S]*?<\/w:drawing>/g)
      ?.find((candidate) => candidate.includes("KOMPAKT_DEKORATION"));
    if (decoration) {
      documentXml = removeEmptyParagraphs(
        documentXml.replace(decoration, ""),
      );
    }
  }

  let hyperlinkIndex = 0;
  documentXml = documentXml.replace(
    /<w:p\b[\s\S]*?<\/w:p>/g,
    (paragraph) => {
      if (
        !paragraph.includes('w:pStyle w:val="ContactLink"') ||
        paragraph.includes("<w:hyperlink")
      ) {
        return paragraph;
      }
      const text = Array.from(
        paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
        (match) => decodeXmlText(match[1]),
      )
        .join("")
        .trim();
      const target = compactHyperlinkTarget(text);
      if (!target) return paragraph;
      hyperlinkIndex += 1;
      const relationshipId = `rIdKompaktLink${hyperlinkIndex}`;
      relationshipsXml = relationshipsXml.replace(
        "</Relationships>",
        `<Relationship Id="${relationshipId}" ` +
          'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" ' +
          `Target="${escapeXmlAttribute(target)}" TargetMode="External"/>` +
          "</Relationships>",
      );
      return paragraph.replace(
        /(<w:r\b[\s\S]*?<\/w:r>)/,
        `<w:hyperlink r:id="${relationshipId}" w:history="1">$1</w:hyperlink>`,
      );
    },
  );
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", relationshipsXml);
};

const replaceProfilePhoto = (
  zip: PizZip,
  dataUrl: string,
  cleanEmptyParagraphs = true,
) => {
  const documentPart = zip.file("word/document.xml");
  const relationshipsPart = zip.file(
    "word/_rels/document.xml.rels",
  );
  if (!documentPart || !relationshipsPart) {
    return { found: false };
  }
  let documentXml = documentPart.asText();
  const drawing = documentXml
    .match(/<w:drawing>[\s\S]*?<\/w:drawing>/g)
    ?.find((candidate) =>
      /<wp:docPr\b[^>]*(?:descr|title)="PROFILFOTO"[^>]*\/>/.test(
        candidate,
      ),
    );
  if (!drawing) return { found: false };

  const relationshipId = drawing.match(
    /<a:blip\b[^>]*r:embed="([^"]+)"/,
  )?.[1];
  const encodedPhoto = dataUrl.match(profilePhotoDataUrl)?.[1];
  if (!relationshipId || !encodedPhoto) {
    documentXml = documentXml.replace(drawing, "");
    zip.file(
      "word/document.xml",
      cleanEmptyParagraphs ? removeEmptyParagraphs(documentXml) : documentXml,
    );
    return { found: true };
  }

  const relationshipsXml = relationshipsPart.asText();
  const escapedId = relationshipId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const target = relationshipsXml.match(
    new RegExp(
      `<Relationship\\b(?=[^>]*\\bId="${escapedId}")(?=[^>]*\\bTarget="([^"]+)")[^>]*/>`,
    ),
  )?.[1];
  if (!target) {
    documentXml = documentXml.replace(drawing, "");
    zip.file(
      "word/document.xml",
      cleanEmptyParagraphs ? removeEmptyParagraphs(documentXml) : documentXml,
    );
    return { found: true };
  }

  const photoBytes = Buffer.from(
    encodedPhoto.replace(/\s/g, ""),
    "base64",
  );
  zip.file(path.posix.join("word", target), photoBytes);
  const crop = centeredSquareCrop(photoBytes);
  const cropElement =
    `<a:srcRect l="${crop.left}" t="${crop.top}" ` +
    `r="${crop.right}" b="${crop.bottom}"/>`;
  const updatedDrawing = drawing.replace(
    /(<a:blip\b[^>]*\/>)(?:<a:srcRect\b[^>]*\/>)?/,
    `$1${cropElement}`,
  );
  documentXml = documentXml.replace(drawing, updatedDrawing);
  zip.file(
    "word/document.xml",
    cleanEmptyParagraphs ? removeEmptyParagraphs(documentXml) : documentXml,
  );
  return { found: true };
};

export class TemplatePlaceholderService {
  async createDocument(
    template: DocumentTemplate,
    targetPath: string,
    data: Record<string, string>,
  ): Promise<CreatedDocumentResult> {
    if (template.extension === ".doc") {
      await copyFile(template.filePath, targetPath);
      return {
        templateId: template.id,
        fileName: path.basename(targetPath),
        filePath: targetPath,
        extension: ".doc",
        replacedPlaceholders: [],
        warning:
          "Das ältere DOC-Format wurde sicher kopiert. Platzhalter werden in DOC-Dateien nicht automatisch ersetzt.",
      };
    }
    try {
      const bytes = await readFile(template.filePath);
      const zip = new PizZip(bytes);
      if (template.extension === ".dotx") {
        const contentTypes = zip.file("[Content_Types].xml");
        if (contentTypes) {
          zip.file(
            "[Content_Types].xml",
            contentTypes
              .asText()
              .replace(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
              ),
          );
        }
      }
      if (template.documentType === "anschreiben") {
        applyCoverLetterJustification(zip);
      }
      const document = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{{", end: "}}" },
        nullGetter: (part) => `{{${part.value}}}`,
      });
      const fullText = document.getFullText();
      const aliasKeys = Object.keys(templatePlaceholderAliases) as Array<
        keyof typeof templatePlaceholderAliases
      >;
      const normalizedData = Object.fromEntries(
        [
          ...Object.entries(data),
          ...templatePlaceholderKeys.map(
            (key) => [key, data[key] ?? ""] as const,
          ),
          ...aliasKeys.map(
            (alias) =>
              [
                alias,
                data[alias] ??
                  data[templatePlaceholderAliases[alias]] ??
                  "",
              ] as const,
          ),
        ],
      );
      if (
        template.documentType === "anschreiben" &&
        !fullText.includes("{{ZUSATZABSATZ}}") &&
        !fullText.includes("{{EK_PARAGRAF}}") &&
        normalizedData.ZUSATZABSATZ?.trim()
      ) {
        normalizedData.SCHLUSSTEXT = [
          normalizedData.ZUSATZABSATZ,
          normalizedData.SCHLUSSTEXT,
        ]
          .filter((value) => value?.trim())
          .join("\n\n");
      }
      // Anlagen always belong after the signature.  Clear a legacy placeholder
      // in the document body and append the generated list at the end instead.
      const coverLetterAttachmentNote =
        template.documentType === "anschreiben"
          ? normalizedData.ANLAGENHINWEIS ?? ""
          : "";
      if (template.documentType === "anschreiben") {
        normalizedData.ANLAGENHINWEIS = "";
      }
      if (template.id === klassischLebenslaufTemplateConfig.id) {
        for (const [titleKey, contentKeys] of [
          ["KENNTNISSE_TITEL", ["KENNTNISSE"]],
          [
            "SPRACHEN_TITEL",
            ["SPRACHEN_ATS", "SPRACHE_1", "SPRACHE_2", "SPRACHE_3"],
          ],
          [
            "STAERKEN_TITEL",
            [
              "STAERKEN_ATS",
              "STAERKE_1_TITEL",
              "STAERKE_2_TITEL",
              "STAERKE_3_TITEL",
            ],
          ],
          ["ZERTIFIKATE_TITEL", ["ZERTIFIKATE"]],
        ] as const) {
          if (
            !contentKeys.some((key) => normalizedData[key]?.trim())
          ) {
            normalizedData[titleKey] = "";
          }
        }
      }
      const replacedPlaceholders = [
        ...templatePlaceholderKeys,
        ...aliasKeys,
      ].filter((key) => fullText.includes(`{{${key}}}`));
      document.render(normalizedData);
      const renderedZip = document.getZip();
      if (template.documentType === "anschreiben") {
        appendCoverLetterAttachments(
          renderedZip,
          coverLetterAttachmentNote,
          normalizedHex(data.DESIGN_PRIMARY, "0B3D86"),
        );
      }
      if (
        template.id === zeitgenoessischLebenslaufTemplateConfig.id ||
        template.id === kreativLebenslaufTemplateConfig.id ||
        template.id === ivyLeagueLebenslaufTemplateConfig.id ||
        template.id === kompaktLebenslaufTemplateConfig.id ||
        template.id === stilvollLebenslaufTemplateConfig.id ||
        template.id === einspaltigLebenslaufTemplateConfig.id ||
        template.id === klassischLebenslaufTemplateConfig.id ||
        template.id === gepflegtLebenslaufTemplateConfig.id
      ) {
        applyManagedResumeDesignTokens(template.id, renderedZip, data);
      }
      if (template.id === kompaktLebenslaufTemplateConfig.id) {
        applyKompaktDocumentOptions(renderedZip, data);
      }
      const photoResult = replaceProfilePhoto(
        renderedZip,
        data.PROFILFOTO ?? "",
        template.id !== klassischLebenslaufTemplateConfig.id,
      );
      if (
        !photoResult.found &&
        template.documentType === "lebenslauf" &&
        template.id !== klassischLebenslaufTemplateConfig.id
      ) {
        const documentPart = renderedZip.file("word/document.xml");
        if (documentPart) {
          renderedZip.file(
            "word/document.xml",
            removeEmptyParagraphs(documentPart.asText()),
          );
        }
      } else {
        replacedPlaceholders.push("PROFILFOTO");
      }
      if (template.id === klassischLebenslaufTemplateConfig.id) {
        applyManagedHyperlinkTargets(renderedZip, data);
        const documentPart = renderedZip.file("word/document.xml");
        if (documentPart) {
          const documentXml = documentPart.asText();
          renderedZip.file(
            "word/document.xml",
            cleanKlassischDocumentXml(documentXml),
          );
        }
      }
      const output = renderedZip
        .generate({ type: "nodebuffer", compression: "DEFLATE" });
      await writeFile(targetPath, output);
      return {
        templateId: template.id,
        fileName: path.basename(targetPath),
        filePath: targetPath,
        extension: ".docx",
        replacedPlaceholders,
      };
    } catch (error) {
      if (error instanceof TemplateError) throw error;
      const templateError = toTemplateError(error);
      throw new TemplateError(
        `Die Word-Vorlage ist beschädigt oder enthält ungültige Platzhalter. ${templateError.message}`,
        "CORRUPT",
      );
    }
  }
}
