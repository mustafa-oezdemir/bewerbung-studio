import type { Attachment, DocumentListSetting } from "./schema";

export type ApplicationDocumentItem = {
  key: string;
  label: string;
  isVisible: boolean;
};

const attachmentKey = (id: string) => `attachment:${id}`;

/** The two combined PDFs: the digital Bewerbungsunterlagen (e-mail, online) and the Bewerbungsmappe with Deckblatt. */
export const documentPackages = ["bewerbungsunterlagen", "mappe"] as const;
export type DocumentPackage = (typeof documentPackages)[number];
export const isDocumentPackage = (target: string): target is DocumentPackage =>
  (documentPackages as readonly string[]).includes(target);

/**
 * The generated pages of a combined PDF, in order; the selected Zeugnisse and then Zertifikate follow them
 * (`getPackageAttachmentPaths`). Both PDFs share this order; only the Bewerbungsmappe starts with the Deckblatt.
 */
export const packageDocumentOrder = (kind: DocumentPackage, includeMotivation: boolean) => [
  ...(kind === "mappe" ? ["deckblatt" as const] : []),
  "anschreiben" as const,
  "lebenslauf" as const,
  ...(includeMotivation ? ["motivation" as const] : []),
];

/**
 * The documents of a Bewerbung in the order of the Bewerbungsunterlagen and the Bewerbungsmappe: Anschreiben,
 * Lebenslauf, optional Motivationsschreiben, then Zeugnisse and the other attachments.
 */
export const getApplicationDocumentItems = (
  attachments: readonly Attachment[],
  applicationId: string,
  settings: readonly DocumentListSetting[] = [],
  includeMotivation = false,
): ApplicationDocumentItem[] => {
  const candidates = [
    { key: "anschreiben", label: "Anschreiben" },
    { key: "lebenslauf", label: "Lebenslauf" },
    ...(includeMotivation ? [{ key: "motivation", label: "Motivationsschreiben" }] : []),
    ...attachments
      .filter(
        (attachment) =>
          attachment.applicationId === applicationId &&
          attachment.includedInPackage,
      )
      .sort(
        (left, right) =>
          (left.category === right.category
            ? 0
            : left.category === "Zeugnisse"
              ? -1
              : 1) || left.order - right.order,
      )
      .map((attachment) => ({
        key: attachmentKey(attachment.id),
        label: attachment.fileName,
      })),
  ];
  const settingsByKey = new Map(
    settings.map((setting) => [setting.key, setting]),
  );

  return candidates.flatMap((candidate) => {
    const setting = settingsByKey.get(candidate.key);
    if (setting?.isDeleted) return [];
    return [
      {
        ...candidate,
        label: setting?.label.trim() || candidate.label,
        isVisible: setting?.isVisible ?? true,
      },
    ];
  });
};

export const getVisibleApplicationDocumentLabels = (
  attachments: readonly Attachment[],
  applicationId: string,
  settings: readonly DocumentListSetting[] = [],
  includeMotivation = false,
) =>
  getApplicationDocumentItems(attachments, applicationId, settings, includeMotivation)
    .filter((item) => item.isVisible)
    .map((item) => item.label);
