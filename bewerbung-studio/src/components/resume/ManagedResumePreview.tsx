import type { DocumentDesignSettings } from "../../shared/documentDesign";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { inheritResumeSectionStyles } from "../../shared/resumeSectionStyleInheritance";
import { resolveTemplateId } from "../../shared/templates";
import { resumeTemplateStyleSources } from "./resumeTemplateStyleSources";
import type { ApplicantProfile } from "../../shared/schema";
import type { ResolvedCvDocument } from "../../shared/resolveCvDocument";
import {
  applyManagedResumeOutput,
  managedResumeCss,
} from "../../shared/resumeManagedOutput";

const inheritedStyles = new Map<string, string>();
const templateStyles = (templateId: string) => {
  const id = resolveTemplateId(templateId);
  if (!inheritedStyles.has(id)) inheritedStyles.set(id,
    inheritResumeSectionStyles(resumeTemplateStyleSources[id] ?? "", id, "preview", true));
  return inheritedStyles.get(id);
};

export function ManagedResumePreview({
  children,
  profile,
  templateId,
  pageNumber,
  totalPages,
  designSettings,
  resolvedCv,
}: {
  children: ReactNode;
  profile: ApplicantProfile | undefined;
  templateId: string;
  pageNumber: number;
  totalPages: number;
  designSettings?: DocumentDesignSettings;
  resolvedCv?: ResolvedCvDocument;
}) {
  const html = applyManagedResumeOutput(
    renderToStaticMarkup(<>{children}</>),
    profile,
    templateId,
    pageNumber,
    totalPages,
    designSettings,
    resolvedCv,
  );
  return (
    <>
      <style>{managedResumeCss + templateStyles(templateId)}</style>
      <div
        className="managed-resume-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
