import { describe, expect, it } from "vitest";
import { getApplicationDocumentItems } from "./applicationDocuments";
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
