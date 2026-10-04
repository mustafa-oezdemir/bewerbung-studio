import { mkdir, writeFile } from "../security/secure-fs";
import path from "node:path";
import PizZip from "pizzip";
import type { CreatedDocumentResult } from "../../src/features/templates/template.types";
import { wordMusterTemplateConfig } from "../../src/features/templates/template.constants";
import { sanitizeSynchronizedDocumentFileName } from "./template-filename.service";
import { letterFontSizeToPt, type DocumentFontSize } from "../../src/shared/documentDesign";

const pngDataUrl = /^data:image\/png;base64,([a-z0-9+/=\s]+)$/i;

const escapeXml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const color = (value: string | undefined, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value ?? "") ? value!.slice(1).toUpperCase() : fallback;

const lines = (...values: Array<string | undefined>) =>
  values
    .flatMap((value) => (value ?? "").split(/\r?\n/))
    .map((value) => value.trim())
    .filter(Boolean);

const imageSize = (bytes: Buffer) => {
  if (bytes.length >= 24 && bytes.toString("ascii", 1, 4) === "PNG") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  return { width: 4, height: 1 };
};

const signatureDrawing = (bytes: Buffer) => {
  const { width, height } = imageSize(bytes);
  const maxWidth = 1_728_000;
  const maxHeight = 504_000;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const cx = Math.max(1, Math.round(width * scale));
  const cy = Math.max(1, Math.round(height * scale));
  return `<w:p><w:pPr><w:spacing w:before="40" w:after="20"/><w:keepNext/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Unterschrift" descr="UNTERSCHRIFT_GRAFIK"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="unterschrift.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdSignature" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:noFill/></a:ln></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
};

export const createDefaultCoverLetterDocument = async (
  targetDirectory: string,
  requestedBaseName: string,
  data: Record<string, string>,
): Promise<CreatedDocumentResult> => {
  const font = data.DESIGN_FONT || "Arial";
  const accent = color(data.DESIGN_PRIMARY, "123F8C");
  const secondary = color(data.DESIGN_ACCENT, "244766");
  const signatureMatch = data.UNTERSCHRIFT_GRAFIK?.match(pngDataUrl);
  const signatureBytes = signatureMatch
    ? Buffer.from(signatureMatch[1].replace(/\s/g, ""), "base64")
    : undefined;
  const bodyValues = lines(
    data.EINLEITUNG,
    data.HAUPTTEXT || data.FACHLICHE_EIGNUNG,
    data.UNTERNEHMENSBEZUG,
    data.ZUSATZABSATZ,
    data.SCHLUSSTEXT,
  );
  const dense = bodyValues.join(" ").length > 2_250 || bodyValues.length > 6;
  const sizeChoice = Object.hasOwn(letterFontSizeToPt, data.DESIGN_FONT_SIZE)
    ? data.DESIGN_FONT_SIZE as DocumentFontSize
    : "medium";
  const bodySize = letterFontSizeToPt[sizeChoice] * 2;
  const bodyLine = 276;
  const paragraphAfter = dense ? 105 : 145;
  const run = (
    value: string,
    size: number,
    options: { bold?: boolean; color?: string } = {},
  ) =>
    `<w:r><w:rPr><w:rFonts w:ascii="${escapeXml(font)}" w:hAnsi="${escapeXml(font)}"/>${options.bold ? "<w:b/>" : ""}<w:color w:val="${options.color ?? "172026"}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
  const paragraph = (
    value: string,
    size = bodySize,
    options: {
      bold?: boolean;
      color?: string;
      before?: number;
      after?: number;
      align?: "left" | "center" | "right" | "both";
      line?: number;
      keepNext?: boolean;
      style?: string;
      bottomBorder?: string;
    } = {},
  ) =>
    `<w:p><w:pPr>${options.style ? `<w:pStyle w:val="${options.style}"/>` : ""}<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? paragraphAfter}" w:line="${options.line ?? bodyLine}" w:lineRule="auto"/>${options.align ? `<w:jc w:val="${options.align}"/>` : ""}${options.bottomBorder ? `<w:pBdr><w:bottom w:val="single" w:sz="18" w:space="1" w:color="${options.bottomBorder}"/></w:pBdr>` : ""}${options.keepNext ? "<w:keepNext/>" : ""}</w:pPr>${run(value, size, options)}</w:p>`;
  const senderContactLine = lines(
    data.BEWERBER_ADRESSE,
    `${data.BEWERBER_PLZ ?? ""} ${data.BEWERBER_ORT ?? ""}`.trim(),
    data.BEWERBER_EMAIL,
    data.BEWERBER_TELEFON,
  ).join(" | ");
  const sender = [
    paragraph(data.BEWERBER_NAME, 32, {
      bold: true,
      color: "000000",
      after: 0,
      line: 320,
      align: "center",
      style: "ApplicationSender",
    }),
    paragraph(data.BERUFSBEZEICHNUNG || data.STELLENBEZEICHNUNG, 22, {
      bold: true,
      color: accent,
      after: 0,
      line: 240,
      align: "center",
      style: "ApplicationSender",
    }),
    paragraph(senderContactLine, 20, {
      color: "000000",
      after: 0,
      line: 230,
      align: "center",
      style: "ApplicationSender",
      bottomBorder: accent,
    }),
  ].join("");
  const recipientLines = lines(
    data.FIRMA_NAME,
    data.ANSPRECHPARTNER,
    data.FIRMA_ABTEILUNG,
    data.FIRMA_ADRESSE,
    `${data.FIRMA_PLZ ?? ""} ${data.FIRMA_ORT ?? ""}`.trim(),
  );
  const recipient = recipientLines
    .map((value) =>
      paragraph(value, 20, {
        after: 0,
        line: 235,
        style: "ApplicationRecipient",
      }),
    )
    .join("");
  const placeAndDate = [
    data.BEWERBER_ORT,
    data.BEWERBUNGSDATUM_LANG
      ? `den ${data.BEWERBUNGSDATUM_LANG}`
      : data.BEWERBUNGSDATUM,
  ]
    .filter(Boolean)
    .join(", ");
  const subjectBase = data.BETREFF || `Bewerbung als ${data.STELLENBEZEICHNUNG}`;
  const subject =
    data.STELLENNUMMER && !subjectBase.includes(data.STELLENNUMMER)
      ? `${subjectBase} - Referenz ${data.STELLENNUMMER}`
      : subjectBase;
  const greeting = paragraph(data.ANREDE, bodySize, {
    before: 0,
    after: paragraphAfter,
    keepNext: true,
    style: "ApplicationSalutation",
  });
  const body = [
    data.EINLEITUNG
      ? paragraph(data.EINLEITUNG, bodySize, {
          after: dense ? 115 : 180,
          align: "both",
          style: "ApplicationBody",
        })
      : "",
    ...lines(data.HAUPTTEXT || data.FACHLICHE_EIGNUNG, data.ZUSATZABSATZ).map((value) =>
      paragraph(value, bodySize, {
        align: "both",
        style: "ApplicationBody",
      }),
    ),
    data.UNTERNEHMENSBEZUG
      ? paragraph(data.UNTERNEHMENSBEZUG, bodySize, {
          before: 20,
          after: dense ? 120 : 180,
          align: "both",
          style: "ApplicationBody",
        })
      : "",
    data.SCHLUSSTEXT
      ? paragraph(data.SCHLUSSTEXT, bodySize, {
          before: 20,
          after: 0,
          align: "both",
          keepNext: true,
          style: "ApplicationClosing",
        })
      : "",
  ].join("");
  const closing = paragraph(
    (data.GRUSSFORMEL || "Mit freundlichen Grüßen").replace(/,\s*$/, ""),
    bodySize,
    {
      before: dense ? 180 : 240,
      after: signatureBytes ? 0 : 360,
      keepNext: true,
      style: "ApplicationGreeting",
    },
  );
  const signature = signatureBytes ? signatureDrawing(signatureBytes) : "";
  const name = paragraph(data.UNTERSCHRIFT || data.BEWERBER_NAME, bodySize, {
    after: data.ANLAGENHINWEIS ? 230 : 0,
    keepNext: Boolean(data.ANLAGENHINWEIS),
    style: "ApplicationSignatureName",
  });
  const attachmentLines = lines(data.ANLAGENHINWEIS);
  const attachments = attachmentLines
    .map((value, index) =>
      paragraph(value, 18, {
        bold: index === 0,
        color: index === 0 ? secondary : "172026",
        after: 0,
        style: "ApplicationAttachments",
      }),
    )
    .join("");

  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${signatureBytes ? '<Default Extension="png" ContentType="image/png"/>' : ""}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:tbl><w:tblPr><w:tblW w:w="9355" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:bottom w:val="single" w:sz="18" w:color="${accent}"/></w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="9355"/></w:tblGrid><w:tr><w:trPr><w:trHeight w:val="1260" w:hRule="atLeast"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9355" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${sender}</w:tc></w:tr></w:tbl><w:tbl><w:tblPr><w:tblW w:w="9355" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="9355"/></w:tblGrid><w:tr><w:trPr><w:trHeight w:val="1800" w:hRule="atLeast"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9355" w:type="dxa"/><w:vAlign w:val="bottom"/><w:tcMar><w:top w:w="520" w:type="dxa"/></w:tcMar></w:tcPr>${recipient}</w:tc></w:tr></w:tbl>${paragraph(placeAndDate, 20, { align: "right", after: 520, style: "ApplicationDate" })}${paragraph(subject, bodySize, { bold: true, color: accent, after: 280, keepNext: true, style: "ApplicationSubject" })}${greeting}${body}${closing}${signature}${name}${attachments}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="680" w:right="1134" w:bottom="1417" w:left="1134" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${signatureBytes ? '<Relationship Id="rIdSignature" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/unterschrift.png"/>' : ""}</Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${escapeXml(font)}" w:hAnsi="${escapeXml(font)}"/><w:sz w:val="${bodySize}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[
      ["ApplicationSender", "Application Sender"],
      ["ApplicationReturnAddress", "Application Return Address"],
      ["ApplicationRecipient", "Application Recipient"],
      ["ApplicationDate", "Application Date"],
      ["ApplicationSubject", "Application Subject"],
      ["ApplicationReference", "Application Reference"],
      ["ApplicationSalutation", "Application Salutation"],
      ["ApplicationBody", "Application Body"],
      ["ApplicationClosing", "Application Closing"],
      ["ApplicationGreeting", "Application Greeting"],
      ["ApplicationSignatureName", "Application Signature Name"],
      ["ApplicationAttachments", "Application Attachments"],
    ]
      .map(
        ([id, name]) =>
          `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>`,
      )
      .join("")}</w:styles>`,
  );
  zip.file(
    "word/settings.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
  );
  if (signatureBytes) zip.file("word/media/unterschrift.png", signatureBytes);
  await mkdir(targetDirectory, { recursive: true });
  const fileName = `${sanitizeSynchronizedDocumentFileName(requestedBaseName)}.docx`;
  const filePath = path.join(targetDirectory, fileName);
  await writeFile(filePath, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
  return {
    templateId: wordMusterTemplateConfig.id,
    fileName,
    filePath,
    extension: ".docx",
    replacedPlaceholders: [
      "BEWERBER_NAME",
      "BEWERBER_ADRESSE",
      "BEWERBER_PLZ",
      "BEWERBER_ORT",
      "BEWERBER_TELEFON",
      "BEWERBER_EMAIL",
      "BEWERBER_WEBSITE",
      "FIRMA_NAME",
      "ANSPRECHPARTNER",
      "FIRMA_ABTEILUNG",
      "FIRMA_ADRESSE",
      "FIRMA_PLZ",
      "FIRMA_ORT",
      "BEWERBUNGSDATUM",
      "BEWERBUNGSDATUM_LANG",
      "BETREFF",
      "STELLENNUMMER",
      "ANREDE",
      "UNTERSCHRIFT_GRAFIK",
      "ANLAGENHINWEIS",
    ],
  };
};
