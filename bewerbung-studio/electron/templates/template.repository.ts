import {
  access,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "../security/secure-fs";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import type { ApplicationPaths } from "../../src/config/application-paths";
import {
  einspaltigLebenslaufTemplateConfig,
  elegantLebenslaufTemplateConfig,
  ivyLeagueLebenslaufTemplateConfig,
  klassischLebenslaufTemplateConfig,
  gepflegtLebenslaufTemplateConfig,
  kompaktLebenslaufTemplateConfig,
  kreativLebenslaufTemplateConfig,
  modernLebenslaufTemplateConfig,
  stilvollLebenslaufTemplateConfig,
  zeitgenoessischLebenslaufTemplateConfig,
  wordMusterTemplateConfig,
} from "../../src/features/templates/template.constants";
import type {
  DocumentTemplate,
  TemplateDocumentType,
  TemplateMetadata,
  TemplateScanResult,
} from "../../src/features/templates/template.types";
import { TemplatePreviewService } from "./template-preview.service";
import { metadataPathFor, TemplateScanner } from "./template-scanner";
import { withOneDriveRetry } from "./template-validator";

const errorCode = (error: unknown) =>
  typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";

const resolveManagedTemplateId = (templateId: string) =>
  templateId === "word-lebenslauf-einfach"
    ? einspaltigLebenslaufTemplateConfig.id
    : templateId;

export class TemplateRepository {
  private templates: DocumentTemplate[] = [];
  private readonly scanner: TemplateScanner;
  private readonly previewService: TemplatePreviewService;

  constructor(private readonly paths: ApplicationPaths) {
    this.scanner = new TemplateScanner(paths);
    this.previewService = new TemplatePreviewService(paths);
  }

  async initialize() {
    await Promise.all(
      [
        this.paths.musterRoot,
        this.paths.anschreibenTemplates,
        this.paths.deckblattTemplates,
        this.paths.lebenslaufTemplates,
        this.paths.anschreibenDocuments,
        this.paths.previewCache,
        this.paths.systemTemplateCache,
      ].map((directory) => mkdir(directory, { recursive: true })),
    );
    await this.ensureWordMusterTemplate();
    await this.ensureZeitgenoessischLebenslaufTemplate();
    await this.ensureKreativLebenslaufTemplate();
    await this.ensureIvyLeagueLebenslaufTemplate();
    await this.ensureKompaktLebenslaufTemplate();
    await this.ensureStilvollLebenslaufTemplate();
    await this.ensureEinspaltigLebenslaufTemplate();
    await this.ensureKlassischLebenslaufTemplate();
    await this.ensureElegantLebenslaufTemplate();
    await this.ensureGepflegtLebenslaufTemplate();
    await this.ensureModernLebenslaufTemplate();
    return this.refresh();
  }

  private async ensureWordMusterTemplate() {
    const targetPath = path.join(
      this.paths.anschreibenTemplates,
      wordMusterTemplateConfig.fileName,
    );
    try {
      await access(targetPath);
    } catch {
      const uploadedSourcePath = path.join(
        this.paths.anschreibenDocuments,
        wordMusterTemplateConfig.fileName,
      );
      try {
        await access(uploadedSourcePath);
      } catch {
        return;
      }
      await withOneDriveRetry(() => copyFile(uploadedSourcePath, targetPath));
    }
    await this.writeMetadata(targetPath, {
      id: wordMusterTemplateConfig.id,
      name: wordMusterTemplateConfig.name,
      documentType: wordMusterTemplateConfig.documentType,
      format: wordMusterTemplateConfig.format,
      source: wordMusterTemplateConfig.source,
      sortOrder: wordMusterTemplateConfig.sortOrder,
      description: wordMusterTemplateConfig.description,
      tags: [...wordMusterTemplateConfig.tags],
      isSystemTemplate: wordMusterTemplateConfig.isSystemTemplate,
      supportsPreview: wordMusterTemplateConfig.supportsPreview,
      supportsPlaceholders: wordMusterTemplateConfig.supportsPlaceholders,
      editableInWord: wordMusterTemplateConfig.editableInWord,
      isProtected: wordMusterTemplateConfig.isProtected,
    });
  }

  private async copyBundledTemplateIfMissing(
    fileName: string,
    targetPath: string,
  ) {
    try {
      await access(targetPath);
      return true;
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }

    if (!this.paths.bundledTemplatesRoot) return false;
    const bundledPath = path.join(this.paths.bundledTemplatesRoot, fileName);
    try {
      await access(bundledPath);
    } catch (error) {
      if (errorCode(error) === "ENOENT") return false;
      throw error;
    }
    await withOneDriveRetry(async () => {
      try {
        await copyFile(bundledPath, targetPath, fsConstants.COPYFILE_EXCL);
      } catch (error) {
        if (errorCode(error) !== "EEXIST") throw error;
      }
    });
    return true;
  }

  private async ensureElegantLebenslaufTemplate() {
    const targetPath = path.join(
      this.paths.lebenslaufTemplates,
      elegantLebenslaufTemplateConfig.fileName,
    );
    const available = await this.copyBundledTemplateIfMissing(
      elegantLebenslaufTemplateConfig.fileName,
      targetPath,
    );
    if (!available) return;

    await this.copyBundledTemplateIfMissing(
      elegantLebenslaufTemplateConfig.atsFileName,
      path.join(
        this.paths.systemTemplateCache,
        elegantLebenslaufTemplateConfig.atsFileName,
      ),
    );
    await this.writeMetadata(targetPath, {
      id: elegantLebenslaufTemplateConfig.id,
      name: elegantLebenslaufTemplateConfig.name,
      documentType: elegantLebenslaufTemplateConfig.documentType,
      format: elegantLebenslaufTemplateConfig.format,
      source: elegantLebenslaufTemplateConfig.source,
      sortOrder: elegantLebenslaufTemplateConfig.sortOrder,
      description: elegantLebenslaufTemplateConfig.description,
      tags: [...elegantLebenslaufTemplateConfig.tags],
      isSystemTemplate: elegantLebenslaufTemplateConfig.isSystemTemplate,
      supportsPreview: elegantLebenslaufTemplateConfig.supportsPreview,
      supportsPlaceholders:
        elegantLebenslaufTemplateConfig.supportsPlaceholders,
      editableInWord: elegantLebenslaufTemplateConfig.editableInWord,
      isProtected: elegantLebenslaufTemplateConfig.isProtected,
      category: elegantLebenslaufTemplateConfig.category,
      layout: elegantLebenslaufTemplateConfig.layout,
      atsFriendly: elegantLebenslaufTemplateConfig.atsFriendly,
      supportsPhoto: elegantLebenslaufTemplateConfig.supportsPhoto,
      supportsAtsMode: elegantLebenslaufTemplateConfig.supportsAtsMode,
    });
  }

  private async ensureZeitgenoessischLebenslaufTemplate() {
    const config = zeitgenoessischLebenslaufTemplateConfig;
    const targetPath = path.join(
      this.paths.lebenslaufTemplates,
      config.fileName,
    );
    const available = await this.copyBundledTemplateIfMissing(
      config.fileName,
      targetPath,
    );
    if (!available) return;

    await this.copyBundledTemplateIfMissing(
      config.atsFileName,
      path.join(this.paths.systemTemplateCache, config.atsFileName),
    );
    await this.writeMetadata(targetPath, {
      id: config.id,
      name: config.name,
      documentType: config.documentType,
      format: config.format,
      source: config.source,
      sortOrder: config.sortOrder,
      description: config.description,
      tags: [...config.tags],
      isSystemTemplate: config.isSystemTemplate,
      supportsPreview: config.supportsPreview,
      supportsPlaceholders: config.supportsPlaceholders,
      editableInWord: config.editableInWord,
      isProtected: config.isProtected,
      category: config.category,
      layout: config.layout,
      atsFriendly: config.atsFriendly,
      supportsPhoto: config.supportsPhoto,
      supportsAtsMode: config.supportsAtsMode,
    });
  }

  private async ensureKreativLebenslaufTemplate() {
    const config = kreativLebenslaufTemplateConfig;
    const targetPath = path.join(
      this.paths.lebenslaufTemplates,
      config.fileName,
    );
    const available = await this.copyBundledTemplateIfMissing(
      config.fileName,
      targetPath,
    );
    if (!available) return;

    await this.copyBundledTemplateIfMissing(
      config.atsFileName,
      path.join(this.paths.systemTemplateCache, config.atsFileName),
    );
    await this.writeMetadata(targetPath, {
      id: config.id,
      name: config.name,
      documentType: config.documentType,
      format: config.format,
      source: config.source,
      sortOrder: config.sortOrder,
      description: config.description,
      tags: [...config.tags],
      isSystemTemplate: config.isSystemTemplate,
      supportsPreview: config.supportsPreview,
      supportsPlaceholders: config.supportsPlaceholders,
      editableInWord: config.editableInWord,
      isProtected: config.isProtected,
      category: config.category,
      layout: config.layout,
      atsFriendly: config.atsFriendly,
      supportsPhoto: config.supportsPhoto,
      supportsBackground: config.supportsBackground,
      supportsAtsMode: config.supportsAtsMode,
      emphasis: config.emphasis,
    });
  }

  private async ensureIvyLeagueLebenslaufTemplate() {
    const config = ivyLeagueLebenslaufTemplateConfig;
    const targetPath = path.join(
      this.paths.lebenslaufTemplates,
      config.fileName,
    );
    const available = await this.copyBundledTemplateIfMissing(
      config.fileName,
      targetPath,
    );
    if (!available) return;

    await this.copyBundledTemplateIfMissing(
      config.atsFileName,
      path.join(this.paths.systemTemplateCache, config.atsFileName),
    );
    await this.writeMetadata(targetPath, {
      id: config.id,
      name: config.name,
      documentType: config.documentType,
      format: config.format,
      source: config.source,
      sortOrder: config.sortOrder,
      description: config.description,
      tags: [...config.tags],
      isSystemTemplate: config.isSystemTemplate,
      supportsPreview: config.supportsPreview,
      supportsPlaceholders: config.supportsPlaceholders,
      editableInWord: config.editableInWord,
      isProtected: config.isProtected,
      category: config.category,
      layout: config.layout,
      atsFriendly: config.atsFriendly,
      supportsPhoto: config.supportsPhoto,
      supportsBackground: config.supportsBackground,
      supportsAtsMode: config.supportsAtsMode,
      emphasis: config.emphasis,
    });
  }

  private async ensureKompaktLebenslaufTemplate() {
    const config = kompaktLebenslaufTemplateConfig;
    const targetPath = path.join(
      this.paths.lebenslaufTemplates,
      config.fileName,
    );
    const available = await this.copyBundledTemplateIfMissing(
      config.fileName,
      targetPath,
    );
    if (!available) return;

    await this.copyBundledTemplateIfMissing(
      config.atsFileName,
      path.join(this.paths.systemTemplateCache, config.atsFileName),
    );
    await this.writeMetadata(targetPath, {
      id: config.id,
      name: config.name,
      documentType: config.documentType,
      format: config.format,
      source: config.source,
      sortOrder: config.sortOrder,
      description: config.description,
      tags: [...config.tags],
      isSystemTemplate: config.isSystemTemplate,
      supportsPreview: config.supportsPreview,
      supportsPlaceholders: config.supportsPlaceholders,
      editableInWord: config.editableInWord,
      isProtected: config.isProtected,
      category: config.category,
      layout: config.layout,
      atsFriendly: config.atsFriendly,
      supportsPhoto: config.supportsPhoto,
      supportsBackground: config.supportsBackground,
      supportsAtsMode: config.supportsAtsMode,
      emphasis: config.emphasis,
    });
  }

  private async ensureStilvollLebenslaufTemplate() {
    await this.ensureManagedResumeTemplate(stilvollLebenslaufTemplateConfig);
  }

  private async ensureEinspaltigLebenslaufTemplate() {
    await this.ensureManagedResumeTemplate(einspaltigLebenslaufTemplateConfig);
  }

  private async ensureKlassischLebenslaufTemplate() {
    await this.ensureManagedResumeTemplate(klassischLebenslaufTemplateConfig);
  }

  private async ensureManagedResumeTemplate(config: {
    id: string;
    fileName: string;
    atsFileName: string;
    name: string;
    documentType: "lebenslauf";
    format: "docx";
    source: "system-word-template";
    sortOrder: number;
    description: string;
    tags: readonly string[];
    isSystemTemplate: true;
    supportsPreview: true;
    supportsPlaceholders: true;
    editableInWord: true;
    isProtected: true;
    category: string;
    layout: string;
    atsFriendly: true;
    supportsPhoto: boolean;
    supportsBackground: true;
    supportsAtsMode: true;
    emphasis: string;
  }) {
    const targetPath = path.join(
      this.paths.lebenslaufTemplates,
      config.fileName,
    );
    const available = await this.copyBundledTemplateIfMissing(
      config.fileName,
      targetPath,
    );
    if (!available) return;
    await this.copyBundledTemplateIfMissing(
      config.atsFileName,
      path.join(this.paths.systemTemplateCache, config.atsFileName),
    );
    await this.writeMetadata(targetPath, {
      id: config.id,
      name: config.name,
      documentType: config.documentType,
      format: config.format,
      source: config.source,
      sortOrder: config.sortOrder,
      description: config.description,
      tags: [...config.tags],
      isSystemTemplate: config.isSystemTemplate,
      supportsPreview: config.supportsPreview,
      supportsPlaceholders: config.supportsPlaceholders,
      editableInWord: config.editableInWord,
      isProtected: config.isProtected,
      category: config.category,
      layout: config.layout,
      atsFriendly: config.atsFriendly,
      supportsPhoto: config.supportsPhoto,
      supportsBackground: config.supportsBackground,
      supportsAtsMode: config.supportsAtsMode,
      emphasis: config.emphasis,
    });
  }

  private async ensureGepflegtLebenslaufTemplate() {
    const config = gepflegtLebenslaufTemplateConfig;
    const targetPath = path.join(
      this.paths.lebenslaufTemplates,
      config.fileName,
    );
    const available = await this.copyBundledTemplateIfMissing(
      config.fileName,
      targetPath,
    );
    if (!available) return;

    await this.copyBundledTemplateIfMissing(
      config.atsFileName,
      path.join(this.paths.systemTemplateCache, config.atsFileName),
    );
    await this.writeMetadata(targetPath, {
      id: config.id,
      name: config.name,
      documentType: config.documentType,
      format: config.format,
      source: config.source,
      sortOrder: config.sortOrder,
      description: config.description,
      tags: [...config.tags],
      isSystemTemplate: config.isSystemTemplate,
      supportsPreview: config.supportsPreview,
      supportsPlaceholders: config.supportsPlaceholders,
      editableInWord: config.editableInWord,
      isProtected: config.isProtected,
      category: config.category,
      layout: config.layout,
      atsFriendly: config.atsFriendly,
      supportsPhoto: config.supportsPhoto,
      supportsAtsMode: config.supportsAtsMode,
    });
  }

  private async ensureModernLebenslaufTemplate() {
    const config = modernLebenslaufTemplateConfig;
    const targetPath = path.join(
      this.paths.lebenslaufTemplates,
      config.fileName,
    );
    const available = await this.copyBundledTemplateIfMissing(
      config.fileName,
      targetPath,
    );
    if (!available) return;

    await this.copyBundledTemplateIfMissing(
      config.atsFileName,
      path.join(this.paths.systemTemplateCache, config.atsFileName),
    );
    await this.writeMetadata(targetPath, {
      id: config.id,
      name: config.name,
      documentType: config.documentType,
      format: config.format,
      source: config.source,
      sortOrder: config.sortOrder,
      description: config.description,
      tags: [...config.tags],
      isSystemTemplate: config.isSystemTemplate,
      supportsPreview: config.supportsPreview,
      supportsPlaceholders: config.supportsPlaceholders,
      editableInWord: config.editableInWord,
      isProtected: config.isProtected,
      category: config.category,
      layout: config.layout,
      atsFriendly: config.atsFriendly,
      supportsPhoto: config.supportsPhoto,
      supportsAtsMode: config.supportsAtsMode,
    });
  }

  async refresh(): Promise<TemplateScanResult> {
    const result = await this.scanner.scanAllTemplates();
    this.templates = await Promise.all(
      result.templates.map(async (template) => ({
        ...template,
        ...(await this.previewService.generate(template)),
      })),
    );
    return {
      templates: structuredClone(this.templates),
      scannedAt: new Date().toISOString(),
      warnings: result.warnings,
    };
  }

  list() {
    return structuredClone(this.templates);
  }

  async getById(templateId: string) {
    const resolvedId = resolveManagedTemplateId(templateId);
    let template = this.templates.find((item) => item.id === resolvedId);
    if (!template) {
      await this.refresh();
      template = this.templates.find((item) => item.id === resolvedId);
    }
    return template ? structuredClone(template) : null;
  }

  async listByType(documentType: TemplateDocumentType) {
    if (!this.templates.length) await this.refresh();
    return structuredClone(
      this.templates.filter(
        (template) => template.documentType === documentType,
      ),
    );
  }

  async listExistingDocuments() {
    if (!this.templates.length) await this.refresh();
    return structuredClone(
      this.templates.filter(
        (template) => template.source === "existing-document",
      ),
    );
  }

  async readMetadata(filePath: string): Promise<TemplateMetadata> {
    try {
      return JSON.parse(
        await readFile(metadataPathFor(filePath), "utf8"),
      ) as TemplateMetadata;
    } catch {
      return {};
    }
  }

  async writeMetadata(filePath: string, changes: TemplateMetadata) {
    const metadata = {
      ...(await this.readMetadata(filePath)),
      ...changes,
    };
    await withOneDriveRetry(() =>
      writeFile(
        metadataPathFor(filePath),
        JSON.stringify(metadata, null, 2),
        "utf8",
      ),
    );
  }
}
