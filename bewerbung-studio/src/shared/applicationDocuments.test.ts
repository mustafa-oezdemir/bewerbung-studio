import { describe, expect, it } from "vitest";
import { getApplicationDocumentItems, isDocumentPackage, packageDocumentOrder } from "./applicationDocuments";
import type { Attachment } from "./schema";

describe("application document selection", () => {
  it("shows only selected documents and applies rename, visibility and deletion settings", () => {
    const applicationId = crypto.randomUUID();
    const selectedId = crypto.randomUUID();
    const hiddenId = crypto.randomUUID();
    const attachment = (
      id: string,
      fileName: string,
      includedInPackage: boolean,
    ): Attachment => ({
      id,
      applicationId,
      category: "Zertifikate",
      fileName,
      description: "",
      documentDate: "",
      order: 0,
      includedInPackage,
      createdAt: new Date().toISOString(),
    });

    expect(
      getApplicationDocumentItems(
        [
          attachment(selectedId, "IBM Full Stack JavaScript.pdf", true),
          attachment(hiddenId, "Nicht ausgewählt.pdf", false),
        ],
        applicationId,
        [
          {
            key: "lebenslauf",
            label: "CV",
            isVisible: false,
            isDeleted: false,
          },
          {
            key: `attachment:${selectedId}`,
            label: "IBM Full Stack JavaScript",
            isVisible: true,
            isDeleted: false,
          },
          {
            key: "anschreiben",
            label: "Anschreiben",
            isVisible: true,
            isDeleted: true,
          },
        ],
      ),
    ).toEqual([
      { key: "lebenslauf", label: "CV", isVisible: false },
      {
        key: `attachment:${selectedId}`,
        label: "IBM Full Stack JavaScript",
        isVisible: true,
      },
    ]);
  });
});

describe("Motivationsschreiben in the document lists", () => {
  const applicationId = "00000000-0000-4000-8000-000000000009";
  const zeugnis: Attachment = {
    id: "00000000-0000-4000-8000-000000000010", applicationId, category: "Zeugnisse", fileName: "Zeugnis.pdf",
    description: "", documentDate: "", order: 0, includedInPackage: true, createdAt: "2026-10-09T09:00:00.000Z",
  };
  it("follows the Lebenslauf and precedes the Zeugnisse only when it is part of the Bewerbung", () => {
    expect(getApplicationDocumentItems([zeugnis], applicationId, [], true).map((item) => item.label))
      .toEqual(["Anschreiben", "Lebenslauf", "Motivationsschreiben", "Zeugnis.pdf"]);
    expect(getApplicationDocumentItems([zeugnis], applicationId, [], false).map((item) => item.label))
      .toEqual(["Anschreiben", "Lebenslauf", "Zeugnis.pdf"]);
    expect(getApplicationDocumentItems([zeugnis], applicationId).map((item) => item.label))
      .toEqual(["Anschreiben", "Lebenslauf", "Zeugnis.pdf"]);
  });

  it("defaults missing legacy settings to visible and applies a later rename or hide choice", () => {
    expect(getApplicationDocumentItems([], applicationId, [{ key: "anschreiben", label: "Anschreiben", isVisible: true, isDeleted: false }], true)
      .find((item) => item.key === "motivation")).toEqual({ key: "motivation", label: "Motivationsschreiben", isVisible: true });
    expect(getApplicationDocumentItems([], applicationId, [{ key: "motivation", label: "Dritte Seite", isVisible: false, isDeleted: false }], true)
      .find((item) => item.key === "motivation")).toEqual({ key: "motivation", label: "Dritte Seite", isVisible: false });
  });
});

describe("Bewerbungsunterlagen and Bewerbungsmappe", () => {
  it("put the Deckblatt after the Anschreiben only in the Mappe", () => {
    expect(packageDocumentOrder("bewerbungsunterlagen", false)).toEqual(["anschreiben", "lebenslauf"]);
    expect(packageDocumentOrder("bewerbungsunterlagen", true)).toEqual(["anschreiben", "lebenslauf", "motivation"]);
    expect(packageDocumentOrder("mappe", false)).toEqual(["anschreiben", "deckblatt", "lebenslauf"]);
    expect(packageDocumentOrder("mappe", true)).toEqual(["anschreiben", "deckblatt", "lebenslauf", "motivation"]);
    expect(isDocumentPackage("bewerbungsunterlagen")).toBe(true);
    expect(isDocumentPackage("mappe")).toBe(true);
    expect(["deckblatt", "anschreiben", "motivation", "lebenslauf"].some(isDocumentPackage)).toBe(false);
  });
});
