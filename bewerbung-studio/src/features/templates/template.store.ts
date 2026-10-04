import { create } from "zustand";
import type {
  DocumentTemplate,
  TemplateDocumentType,
} from "./template.types";

type TemplateStore = {
  templates: DocumentTemplate[];
  warnings: string[];
  scannedAt?: string;
  loading: boolean;
  error?: string;
  notice?: string;
  load: () => Promise<void>;
  add: (documentType: TemplateDocumentType) => Promise<void>;
  use: (
    templateId: string,
    applicationId: string,
    atsMode?: boolean,
  ) => Promise<void>;
  duplicate: (templateId: string) => Promise<void>;
  copyToMuster: (templateId: string) => Promise<void>;
  toggleFavorite: (templateId: string) => Promise<void>;
  remove: (templateId: string) => Promise<void>;
  open: (templateId: string) => Promise<void>;
  openFolder: (templateId: string) => Promise<void>;
  clearMessage: () => void;
};

const messageFrom = (error: unknown) =>
  error instanceof Error ? error.message : "Vorlagenaktion fehlgeschlagen.";

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],
  warnings: [],
  loading: false,
  async load() {
    if (!window.bewerbungsManager) return;
    set({ loading: true, error: undefined });
    try {
      const result = await window.bewerbungsManager.templates.scan();
      set({
        templates: result.templates,
        warnings: result.warnings,
        scannedAt: result.scannedAt,
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: messageFrom(error) });
    }
  },
  async add(documentType) {
    set({ loading: true, error: undefined });
    try {
      const created =
        await window.bewerbungsManager.templates.add({ documentType });
      if (created) {
        await get().load();
        set({ notice: "Vorlage wurde sicher hinzugefügt." });
      } else {
        set({ loading: false });
      }
    } catch (error) {
      set({ loading: false, error: messageFrom(error) });
    }
  },
  async use(templateId, applicationId, atsMode = false) {
    set({ loading: true, error: undefined });
    try {
      const result = await window.bewerbungsManager.templates.use({
        templateId,
        applicationId,
        atsMode,
      });
      set({
        loading: false,
        notice: result.warning || "Dokument wurde erstellt und geöffnet.",
      });
    } catch (error) {
      set({ loading: false, error: messageFrom(error) });
    }
  },
  async duplicate(templateId) {
    set({ loading: true, error: undefined });
    try {
      await window.bewerbungsManager.templates.duplicate(templateId);
      await get().load();
      set({ notice: "Vorlage wurde als neue Datei dupliziert." });
    } catch (error) {
      set({ loading: false, error: messageFrom(error) });
    }
  },
  async copyToMuster(templateId) {
    set({ loading: true, error: undefined });
    try {
      await window.bewerbungsManager.templates.copyToMuster(templateId);
      await get().load();
      set({
        notice:
          "Das Anschreiben wurde kopiert. Das Original blieb unverändert.",
      });
    } catch (error) {
      set({ loading: false, error: messageFrom(error) });
    }
  },
  async toggleFavorite(templateId) {
    try {
      const result =
        await window.bewerbungsManager.templates.toggleFavorite(templateId);
      set({
        templates: result.templates,
        warnings: result.warnings,
        scannedAt: result.scannedAt,
      });
    } catch (error) {
      set({ error: messageFrom(error) });
    }
  },
  async remove(templateId) {
    set({ loading: true, error: undefined });
    try {
      const result =
        await window.bewerbungsManager.templates.remove(templateId);
      set({
        templates: result.templates,
        warnings: result.warnings,
        scannedAt: result.scannedAt,
        loading: false,
        notice: "Eigene Vorlage wurde gelöscht.",
      });
    } catch (error) {
      set({ loading: false, error: messageFrom(error) });
    }
  },
  async open(templateId) {
    try {
      await window.bewerbungsManager.templates.open(templateId);
    } catch (error) {
      set({ error: messageFrom(error) });
    }
  },
  async openFolder(templateId) {
    try {
      await window.bewerbungsManager.templates.openFolder(templateId);
    } catch (error) {
      set({ error: messageFrom(error) });
    }
  },
  clearMessage: () => set({ error: undefined, notice: undefined }),
}));
