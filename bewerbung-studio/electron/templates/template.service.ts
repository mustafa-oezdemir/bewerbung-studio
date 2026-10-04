import {
  copyFile,
  mkdir,
  rm,
  stat,
} from "../security/secure-fs";
import path from "node:path";
import type { ApplicationPaths } from "../../src/config/application-paths";
import {
  defaultTemplateSortOrder,
  einspaltigLebenslaufTemplateConfig,
  elegantLebenslaufTemplateConfig,
  gepflegtLebenslaufTemplateConfig,
  ivyLeagueLebenslaufTemplateConfig,
  klassischLebenslaufTemplateConfig,
  kompaktLebenslaufTemplateConfig,
  kreativLebenslaufTemplateConfig,
  maximumTemplateFileSize,
  stilvollLebenslaufTemplateConfig,
  zeitgenoessischLebenslaufTemplateConfig,
} from "../../src/features/templates/template.constants";
import type {
  CreatedDocumentResult,
  DocumentTemplate,
  TemplateDocumentType,
} from "../../src/features/templates/template.types";
import { TemplateError } from "../../src/features/templates/template.errors";
import {
  createUniqueFilePath,
  sanitizeSynchronizedDocumentFileName,
  sanitizeTemplateFileName,
  templateTimestamp,
} from "./template-filename.service";
import { TemplatePlaceholderService } from "./template-placeholder.service";
import { TemplateRepository } from "./template.repository";
import { metadataPathFor } from "./template-scanner";
import {
  assertAllowedTemplatePath,
  getTemplateExtension,
  isPathInside,
  validateTemplateFile,
  withOneDriveRetry,
} from "./template-validator";

export class TemplateService {
  readonly repository: TemplateRepository;
  private readonly placeholderService = new TemplatePlaceholderService();

  constructor(private readonly paths: ApplicationPaths) {
    this.repository = new TemplateRepository(paths);
  }

  initialize() {
    return this.repository.initialize();
  }

  scanAllTemplates() {
    return this.repository.refresh();
  }

  scanTemplatesByType(documentType: TemplateDocumentType) {
    return this.repository.listByType(documentType);
  }

  scanExistingAnschreiben() {
    return this.repository.listExistingDocuments();
  }

  getTemplateById(templateId: string) {
    return this.repository.getById(templateId);
  }

  private rootForType(documentType: TemplateDocumentType) {
    if (documentType === "anschreiben")
      return this.paths.anschreibenTemplates;
    if (documentType === "deckblatt") return this.paths.deckblattTemplates;
    return this.paths.lebenslaufTemplates;
  }

  async addExternalTemplate(
    sourceFilePath: string,
    documentType: TemplateDocumentType,
    requestedTemplateName?: string,
  ) {
    const extension = getTemplateExtension(sourceFilePath);
    const sourceInfo = await stat(sourceFilePath);
    if (!sourceInfo.isFile()) {
      throw new TemplateError("Die ausgewählte Vorlage ist keine Datei.", "INVALID_FORMAT");
    }
    if (sourceInfo.size > maximumTemplateFileSize) {
      throw new TemplateError(
        "Die Vorlage darf höchstens 25 MB groß sein.",
        "FILE_TOO_LARGE",
      );
    }
    const targetRoot = this.rootForType(documentType);
    await mkdir(targetRoot, { recursive: true });
    const requestedName =
      requestedTemplateName || path.basename(sourceFilePath, extension);
    const targetPath = await createUniqueFilePath(
      targetRoot,
      requestedName,
      extension,
    );
    await withOneDriveRetry(() => copyFile(sourceFilePath, targetPath));
    await this.repository.writeMetadata(targetPath, {
      name: requestedName.replaceAll("_", " "),
      documentType,
      tags: [],
      isFavorite: false,
      isSystemTemplate: false,
      sortOrder: defaultTemplateSortOrder,
      supportsPreview: true,
      supportsPlaceholders: extension !== ".doc",
      editableInWord: true,
      isProtected: false,
    });
    await this.repository.refresh();
    const created = this.repository
      .list()
      .find((template) => template.filePath === targetPath);
    if (!created)
      throw new TemplateError("Die Vorlage konnte nicht hinzugefügt werden.", "NOT_FOUND");
    return created;
  }

  async copyExistingDocumentToTemplates(
    sourceFilePath: string,
    requestedTemplateName?: string,
  ) {
    assertAllowedTemplatePath(this.paths, sourceFilePath);
    const source = this.repository
      .list()
      .find(
        (template) =>
          template.filePath === sourceFilePath &&
          template.source === "existing-document",
      );
    if (!source) {
      throw new TemplateError(
        "Das Anschreiben wurde nicht in den eigenen Dokumenten gefunden.",
        "NOT_FOUND",
      );
    }
    return this.addExternalTemplate(
      source.filePath,
      "anschreiben",
      requestedTemplateName || source.name,
    );
  }

  async copyExistingTemplateById(
    templateId: string,
    requestedTemplateName?: string,
  ) {
    const template = await this.requireTemplate(templateId);
    if (template.source !== "existing-document") {
      throw new TemplateError(
        "Nur eigene Anschreiben können zu Muster hinzugefügt werden.",
        "INVALID_PATH",
      );
    }
    return this.copyExistingDocumentToTemplates(
      template.filePath,
      requestedTemplateName,
    );
  }

  async duplicateTemplate(templateId: string) {
    const template = await this.requireTemplate(templateId);
    const targetRoot = path.dirname(template.filePath);
    const targetPath = await createUniqueFilePath(
      targetRoot,
      `${path.basename(template.fileName, template.extension)}_Kopie`,
      template.extension,
    );
    await withOneDriveRetry(() => copyFile(template.filePath, targetPath));
    if (template.source !== "existing-document") {
      await this.repository.writeMetadata(targetPath, {
        ...(await this.repository.readMetadata(template.filePath)),
        id: undefined,
        name: `${template.name} Kopie`,
        source: "muster-folder",
        sortOrder: defaultTemplateSortOrder,
        isSystemTemplate: false,
        isProtected: false,
      });
    }
    await this.repository.refresh();
    return (
      this.repository
        .list()
        .find((candidate) => candidate.filePath === targetPath) ?? null
    );
  }

  async createDocumentFromTemplate(
    templateId: string,
    targetDirectory: string,
    requestedBaseName: string,
    data: Record<string, string>,
    options: { atsMode?: boolean } = {},
  ): Promise<CreatedDocumentResult> {
    const template = await this.requireTemplate(templateId);
    const allowedDocumentRoots = [
      this.paths.applicationsData,
      this.paths.anschreibenDocuments,
      this.paths.lebenslaufDocuments,
      this.paths.absagenRoot,
    ];
    if (
      !allowedDocumentRoots.some((root) =>
        isPathInside(root, targetDirectory),
      )
    ) {
      throw new TemplateError("Ungültiger Zielordner.", "INVALID_PATH");
    }
    let sourceTemplate = template;
    let warning: string | undefined;
    const managedResumeConfig =
      template.id === elegantLebenslaufTemplateConfig.id
        ? elegantLebenslaufTemplateConfig
        : template.id === zeitgenoessischLebenslaufTemplateConfig.id
          ? zeitgenoessischLebenslaufTemplateConfig
          : template.id === kreativLebenslaufTemplateConfig.id
            ? kreativLebenslaufTemplateConfig
            : template.id === ivyLeagueLebenslaufTemplateConfig.id
              ? ivyLeagueLebenslaufTemplateConfig
            : template.id === kompaktLebenslaufTemplateConfig.id
              ? kompaktLebenslaufTemplateConfig
              : template.id === stilvollLebenslaufTemplateConfig.id
                ? stilvollLebenslaufTemplateConfig
                : template.id === einspaltigLebenslaufTemplateConfig.id
                  ? einspaltigLebenslaufTemplateConfig
                  : template.id === klassischLebenslaufTemplateConfig.id
                    ? klassischLebenslaufTemplateConfig
                      : template.id === gepflegtLebenslaufTemplateConfig.id
                      ? gepflegtLebenslaufTemplateConfig
                      : undefined;
    if (managedResumeConfig && options.atsMode) {
      const atsPath = path.join(
        this.paths.systemTemplateCache,
        managedResumeConfig.atsFileName,
      );
      try {
        await validateTemplateFile(this.paths, atsPath);
        sourceTemplate = { ...template, filePath: atsPath };
      } catch {
        warning = `Die ATS-Variante war nicht verfügbar. Die Standardvorlage „${managedResumeConfig.name}“ wurde verwendet.`;
      }
    }
    await validateTemplateFile(this.paths, sourceTemplate.filePath);
    await mkdir(targetDirectory, { recursive: true });
    const outputExtension =
      template.extension === ".doc" ? ".doc" : ".docx";
    const resumeFirstName =
      data.BEWERBER_VORNAME ?? data.VORNAME ?? "";
    const resumeLastName =
      data.BEWERBER_NACHNAME ?? data.NACHNAME ?? "";
    const outputBaseName = managedResumeConfig
      ? `Lebenslauf_${resumeFirstName}_${resumeLastName}`
      : requestedBaseName;
    const targetPath = await createUniqueFilePath(
      targetDirectory,
      `${sanitizeTemplateFileName(outputBaseName)}_${templateTimestamp()}`,
      outputExtension,
    );
    const result = await withOneDriveRetry(() =>
      this.placeholderService.createDocument(
        sourceTemplate,
        targetPath,
        data,
      ),
    );
    const singlePageContentLength = Object.entries(data)
      .filter(([key]) =>
        /^(ZUSAMMENFASSUNG|BESCHREIBUNG_\d+|ERFOLG_\d+_\d+|ERFOLG_HIGHLIGHT_\d+_(?:TITEL|BESCHREIBUNG)|STAERKE_\d+_BESCHREIBUNG|KENNTNIS_EINTRAEGE_\d+)$/.test(
          key,
        ),
      )
      .reduce((length, [, value]) => length + value.trim().length, 0);
    const filledSinglePageExperiences = Array.from(
      { length: 8 },
      (_, index) => data[`POSITION_${index + 1}`]?.trim() ?? "",
    ).filter(Boolean).length;
    const creativeSinglePageWarning =
      template.id === kreativLebenslaufTemplateConfig.id &&
      !options.atsMode &&
      (singlePageContentLength > 3_200 ||
        filledSinglePageExperiences > 4)
        ? "Der Inhalt passt möglicherweise nicht vollständig auf eine Seite. Bitte kürzen Sie einzelne Beschreibungen oder erlauben Sie eine zweite Seite."
        : undefined;
    const compactSinglePageWarning =
      template.id === kompaktLebenslaufTemplateConfig.id &&
      !options.atsMode &&
      (singlePageContentLength > 3_700 ||
        filledSinglePageExperiences > 5)
        ? "Der Inhalt passt nicht vollständig auf eine Seite. Bitte kürzen Sie einzelne Beschreibungen oder erlauben Sie eine zweite Seite."
        : undefined;
    const compactSummaryWarning =
      template.id === kompaktLebenslaufTemplateConfig.id &&
      (data.ZUSAMMENFASSUNG?.trim().length ?? 0) > 600
        ? "Die Zusammenfassung überschreitet die empfohlenen 600 Zeichen."
        : undefined;
    const normalizeAchievement = (value: string) =>
      value
        .toLocaleLowerCase("de-DE")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    const experienceAchievements = new Set(
      Object.entries(data)
        .filter(
          ([key, value]) =>
            /^ERFOLG_\d+_\d+$/.test(key) && Boolean(value.trim()),
        )
        .map(([, value]) => normalizeAchievement(value)),
    );
    const hasDuplicateCompactAchievement =
      template.id === kompaktLebenslaufTemplateConfig.id &&
      Object.entries(data)
        .filter(
          ([key, value]) =>
            /^ERFOLG_HIGHLIGHT_\d+_BESCHREIBUNG$/.test(key) &&
            Boolean(value.trim()),
        )
        .some(([, value]) =>
          experienceAchievements.has(normalizeAchievement(value)),
        );
    const duplicateAchievementWarning = hasDuplicateCompactAchievement
      ? "Ein hervorgehobener Erfolg wird bereits in der Berufserfahrung verwendet."
      : undefined;
    const combinedWarning = [
      warning,
      creativeSinglePageWarning,
      compactSinglePageWarning,
      compactSummaryWarning,
      duplicateAchievementWarning,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");
    return combinedWarning
      ? { ...result, warning: combinedWarning }
      : result;
  }

  async synchronizeDocumentFromTemplate(
    templateId: string,
    targetDirectory: string,
    requestedBaseName: string,
    data: Record<string, string>,
  ): Promise<CreatedDocumentResult> {
    const template = await this.requireTemplate(templateId);
    const allowedDocumentRoots = [
      this.paths.applicationsData,
      this.paths.anschreibenDocuments,
      this.paths.lebenslaufDocuments,
      this.paths.absagenRoot,
    ];
    if (
      !allowedDocumentRoots.some((root) =>
        isPathInside(root, targetDirectory),
      )
    ) {
      throw new TemplateError("Ungültiger Zielordner.", "INVALID_PATH");
    }
    await validateTemplateFile(this.paths, template.filePath);
    await mkdir(targetDirectory, { recursive: true });
    const outputExtension = template.extension === ".doc" ? ".doc" : ".docx";
    const targetPath = path.join(
      targetDirectory,
      `${sanitizeSynchronizedDocumentFileName(requestedBaseName)}${outputExtension}`,
    );
    return withOneDriveRetry(() =>
      this.placeholderService.createDocument(
        template,
        targetPath,
        data,
      ),
    );
  }

  async toggleTemplateFavorite(templateId: string) {
    const template = await this.requireTemplate(templateId);
    await this.repository.writeMetadata(template.filePath, {
      isFavorite: !template.isFavorite,
    });
    return this.repository.refresh();
  }

  async deleteCustomTemplate(templateId: string) {
    const template = await this.requireTemplate(templateId);
    if (template.isProtected) {
      throw new TemplateError(
        "Diese Word-Vorlage ist geschützt und kann nicht gelöscht werden.",
        "PROTECTED_TEMPLATE",
      );
    }
    if (template.isSystemTemplate) {
      throw new TemplateError(
        "Systemvorlagen können nicht gelöscht werden.",
        "SYSTEM_TEMPLATE",
      );
    }
    if (template.source !== "muster-folder") {
      throw new TemplateError(
        "Eigene Dokumente werden an dieser Stelle nicht gelöscht.",
        "INVALID_PATH",
      );
    }
    await rm(template.filePath);
    await rm(metadataPathFor(template.filePath), { force: true });
    return this.repository.refresh();
  }

  async generateTemplatePreview(templateId: string) {
    const template = await this.requireTemplate(templateId);
    return template.previewDataUrl ?? null;
  }

  private async requireTemplate(templateId: string): Promise<DocumentTemplate> {
    const template = await this.repository.getById(templateId);
    if (!template) {
      throw new TemplateError("Vorlage wurde nicht gefunden.", "NOT_FOUND");
    }
    return template;
  }
}
