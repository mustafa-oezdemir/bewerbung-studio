import { z } from "zod";
import {
  appSettingsSchema, attachmentSchema, calendarEventSchema, customCvDesignSchema,
  todoSchema, workspaceSchema,
} from "./schema";

const referenceSchema = z.object({ id: z.uuid(), path: z.string().min(1) });

export const workspaceIndexSchema = z.object({
  schemaVersion: z.literal(2),
  applications: z.array(referenceSchema),
  profiles: z.array(referenceSchema),
  centralPath: z.string().min(1),
  settings: appSettingsSchema,
  updatedAt: z.iso.datetime(),
});

export const centralDataSchema = z.object({
  schemaVersion: z.literal(1),
  events: z.array(calendarEventSchema),
  attachments: z.array(attachmentSchema),
  todos: z.array(todoSchema),
  customCvDesigns: z.array(customCvDesignSchema),
});

export type WorkspaceIndex = z.infer<typeof workspaceIndexSchema>;
export type CentralData = z.infer<typeof centralDataSchema>;

/** Zod strips unknown properties; migration must not silently discard authored JSON fields. */
export const assertNoDroppedKeys = (raw: unknown, parsed: unknown, location = "Datenbestand"): void => {
  if (!raw || typeof raw !== "object") return;
  if (Array.isArray(raw)) {
    if (!Array.isArray(parsed)) return;
    raw.forEach((value, index) => assertNoDroppedKeys(value, parsed[index], `${location}[${index}]`));
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in parsed)) throw new Error(`Unbekanntes Feld in ${location}.${key}. Die Daten wurden nicht geändert.`);
    assertNoDroppedKeys(value, (parsed as Record<string, unknown>)[key], `${location}.${key}`);
  }
};

export const validateWorkspaceFile = (raw: unknown) => {
  const indexed = workspaceIndexSchema.safeParse(raw);
  if (indexed.success) { assertNoDroppedKeys(raw, indexed.data); return; }
  const legacy = workspaceSchema.parse(raw);
  assertNoDroppedKeys(raw, legacy);
};
