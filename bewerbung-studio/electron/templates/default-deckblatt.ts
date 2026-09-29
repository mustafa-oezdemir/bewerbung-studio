import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import type { CreatedDocumentResult } from "../../src/features/templates/template.types";
import { sanitizeSynchronizedDocumentFileName } from "./template-filename.service";

const templateId = "system-default-deckblatt";
const pngDataUrl = /^data:image\/png;base64,([a-z0-9+/=\s]+)$/i;

const escapeXml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const normalizeColor = (value: string | undefined, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value ?? "") ? value!.slice(1).toUpperCase() : fallback;

const run = (
  value: string,
  font: string,
  size: number,
  color = "172026",
  bold = false,
) =>
  `<w:r><w:rPr><w:rFonts w:ascii="${escapeXml(font)}" w:hAnsi="${escapeXml(font)}"/>` +
  `${bold ? "<w:b/>" : ""}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr>` +
  `<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;

const paragraph = (
  value: string,
  font: string,
  size = 20,
  options: {
    color?: string;
    bold?: boolean;
    before?: number;
    after?: number;
    align?: "left" | "center" | "right" | "both";
    keepNext?: boolean;
  } = {},
) =>
  `<w:p><w:pPr><w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 80}"/>` +
  `${options.align ? `<w:jc w:val="${options.align}"/>` : ""}${options.keepNext ? "<w:keepNext/>" : ""}</w:pPr>` +
  `${run(value, font, size, options.color, options.bold)}</w:p>`;

const tableCell = (content: string, width: number, options = "") =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${options}</w:tcPr>${content}</w:tc>`;

const centeredSquareCrop = (bytes: Buffer) => {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes.subarray(1, 4).toString("ascii") !== "PNG"
  ) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height || width === height) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }
  if (width > height) {
    const crop = Math.round(((width - height) / width / 2) * 100_000);
    return { left: crop, top: 0, right: crop, bottom: 0 };
  }
  const crop = Math.round(((height - width) / height / 2) * 100_000);
  return { left: 0, top: crop, right: 0, bottom: crop };
};

const photoDrawing = (bytes: Buffer) => {
  const crop = centeredSquareCrop(bytes);
  return `<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="1296000" cy="1296000"/><wp:docPr id="1" name="Bewerbungsfoto" descr="PROFILFOTO"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="profilfoto.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdPhoto" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:srcRect l="${crop.left}" t="${crop.top}" r="${crop.right}" b="${crop.bottom}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1296000" cy="1296000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln w="19050"><a:solidFill><a:srgbClr val="D9E0E3"/></a:solidFill></a:ln></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
};

const lines = (value: string | undefined) =>
  (value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

export const createDefaultDeckblattDocument = async (
  targetDirectory: string,
  requestedBaseName: string,
  data: Record<string, string>,
): Promise<CreatedDocumentResult> => {
  const applicantName = data.BEWERBER_NAME?.trim();
  const company = data.FIRMA_NAME?.trim();
  const position = data.STELLENBEZEICHNUNG?.trim();
  const missing = [
    !applicantName ? "Name der Bewerberin oder des Bewerbers" : "",
    !company ? "Unternehmen" : "",
    !position ? "Stellenbezeichnung" : "",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `Deckblatt kann nicht erstellt werden. Bitte ergänzen Sie: ${missing.join(", ")}.`,
    );
  }

  const font = data.DESIGN_FONT || "Arial";
  const accent = normalizeColor(data.DESIGN_PRIMARY, "123F8C");
  const secondary = normalizeColor(data.DESIGN_ACCENT, "244766");
  const photoMatch = data.PROFILFOTO?.match(pngDataUrl);
  const photoBytes = photoMatch
    ? Buffer.from(photoMatch[1].replace(/\s/g, ""), "base64")
    : undefined;
  const documents = lines(data.DECKBLATT_DOKUMENTE);
  const competencies = lines(data.DECKBLATT_KOMPETENZEN);
  const contacts = lines(data.DECKBLATT_KONTAKT);
  const leftDetails = [
    paragraph("BEWERBUNGSUNTERLAGEN", font, 18, {
      color: accent,
      bold: true,
      after: 150,
      keepNext: true,
    }),
    ...documents.map((item) => paragraph(`•  ${item}`, font, 18, { after: 55 })),
  ].join("");
  const rightDetails = [
    ...(competencies.length
      ? [
          paragraph("KERNKOMPETENZEN", font, 18, {
            color: accent,
            bold: true,
            after: 150,
            keepNext: true,
          }),
          paragraph(competencies.join(" · "), font, 18, { after: 260 }),
        ]
      : []),
    ...(contacts.length
      ? [
          paragraph("KONTAKT", font, 18, {
            color: accent,
            bold: true,
            after: 150,
            keepNext: true,
          }),
          ...contacts.map((item) => paragraph(item, font, 18, { after: 55 })),
        ]
      : []),
  ].join("");
  const heroText = [
    paragraph("BEWERBUNG", font, 20, {
      color: accent,
      bold: true,
      after: 190,
      keepNext: true,
    }),
    paragraph(`Bewerbung als ${position}`, font, 44, {
      color: "172026",
      bold: true,
      after: 130,
      keepNext: true,
    }),
    paragraph(`bei ${company}`, font, 25, { color: secondary, after: 80 }),
    ...(data.DECKBLATT_STANDORT
      ? [paragraph(`Standort: ${data.DECKBLATT_STANDORT}`, font, 18, { color: "5C6870", after: 40 })]
      : []),
    ...(data.STELLENNUMMER
      ? [paragraph(`Referenz: ${data.STELLENNUMMER}`, font, 18, { color: "5C6870", after: 40 })]
      : []),
    paragraph(data.BEWERBUNGSDATUM, font, 18, { color: "5C6870", after: 0 }),
  ].join("");
  const hero = photoBytes
    ? `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:bottom w:val="single" w:sz="6" w:color="D9E0E3"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="7200"/><w:gridCol w:w="2160"/></w:tblGrid><w:tr>${tableCell(heroText, 7200, '<w:tcMar><w:right w:w="360" w:type="dxa"/></w:tcMar>')}${tableCell(photoDrawing(photoBytes), 2160, '<w:vAlign w:val="top"/>')}</w:tr></w:tbl>`
    : `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:bottom w:val="single" w:sz="6" w:color="D9E0E3"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid><w:tr>${tableCell(heroText, 9360)}</w:tr></w:tbl>`;
  const identity = [
    paragraph(applicantName!, font, 34, {
      color: accent,
      bold: true,
      before: 650,
      after: 80,
      keepNext: Boolean(data.BERUFSBEZEICHNUNG || data.DECKBLATT_KURZPROFIL),
    }),
    ...(data.BERUFSBEZEICHNUNG
      ? [paragraph(data.BERUFSBEZEICHNUNG, font, 21, { color: secondary, after: 140 })]
      : []),
    ...(data.DECKBLATT_KURZPROFIL
      ? [
          paragraph(data.DECKBLATT_KURZPROFIL, font, 19, {
            color: "455159",
            after: 0,
            align: "both",
          }),
        ]
      : []),
  ].join("");
  const details = `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="D9E0E3"/></w:tblBorders><w:tblCellMar><w:top w:w="300" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="3180"/><w:gridCol w:w="6180"/></w:tblGrid><w:tr>${tableCell(leftDetails, 3180, '<w:tcMar><w:right w:w="240" w:type="dxa"/></w:tcMar>')}${tableCell(rightDetails || paragraph("", font, 18), 6180, '<w:tcMar><w:left w:w="240" w:type="dxa"/></w:tcMar>')}</w:tr></w:tbl>`;

  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${photoBytes ? '<Default Extension="png" ContentType="image/png"/>' : ""}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="30" w:color="${accent}"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="9360" w:type="dxa"/></w:tcPr>${paragraph("", font, 2, { after: 260 })}</w:tc></w:tr></w:tbl>${hero}${identity}${paragraph("", font, 2, { before: 420, after: 0 })}${details}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1275" w:bottom="1020" w:left="1275" w:header="600" w:footer="600" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${photoBytes ? '<Relationship Id="rIdPhoto" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/profilfoto.png"/>' : ""}</Relationships>`,
  );
  zip.file(
    "word/settings.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
  );
  if (photoBytes) zip.file("word/media/profilfoto.png", photoBytes);

  await mkdir(targetDirectory, { recursive: true });
  const fileName = `${sanitizeSynchronizedDocumentFileName(requestedBaseName)}.docx`;
  const filePath = path.join(targetDirectory, fileName);
  await writeFile(filePath, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  return {
    templateId,
    fileName,
    filePath,
    extension: ".docx",
    replacedPlaceholders: [
      "BEWERBER_NAME",
      "FIRMA_NAME",
      "STELLENBEZEICHNUNG",
      "BEWERBUNGSDATUM",
      "DECKBLATT_DOKUMENTE",
      "DECKBLATT_KOMPETENZEN",
      "DECKBLATT_KONTAKT",
      ...(photoBytes ? ["PROFILFOTO"] : []),
    ],
  };
};
