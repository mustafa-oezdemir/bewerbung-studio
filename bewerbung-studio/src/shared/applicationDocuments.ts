import type { Attachment, DocumentListSetting } from "./schema";

export type ApplicationDocumentItem = {
  key: string;
  label: string;
  isVisible: boolean;
};

const attachmentKey = (id: string) => `attachment:${id}`;

export const getApplicationDocumentItems = (
  attachments: readonly Attachment[],
  applicationId: string,
  settings: readonly DocumentListSetting[] = [],
): ApplicationDocumentItem[] => {
  const candidates = [
    { key: "anschreiben", label: "Anschreiben" },
    { key: "lebenslauf", label: "Lebenslauf" },
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
) =>
  getApplicationDocumentItems(attachments, applicationId, settings)
    .filter((item) => item.isVisible)
    .map((item) => item.label);
