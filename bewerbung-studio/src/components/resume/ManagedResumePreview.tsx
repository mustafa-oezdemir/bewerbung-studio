import type { DocumentDesignSettings } from "../../shared/documentDesign";
import { renderToStaticMarkup } from "react-dom/server";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { inheritResumeSectionStyles } from "../../shared/resumeSectionStyleInheritance";
import { resolveTemplateId } from "../../shared/templates";
import { resumeTemplateStyleSources } from "./resumeTemplateStyleSources";
import type { ApplicantProfile } from "../../shared/schema";
import type { ResolvedCvDocument } from "../../shared/resolveCvDocument";
import { elegantManagedCss } from "../../shared/elegantDesign";
import type { ResumePagePlan } from "../../shared/documentPagination";
import {
  applyManagedResumeOutput,
  managedResumeCss,
} from "../../shared/resumeManagedOutput";
import { kreativResolvedCss } from "../../shared/kreativDesign";
import { stilvollResolvedCss } from "../../shared/stilvollDesign";
import { gepflegtResolvedCss } from "../../shared/gepflegtDesign";

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
  const firstPlan = resolvedCv?.pagePlan[0];
  const firstPageHtml = pageNumber > 1 && firstPlan
    ? applyManagedResumeOutput(
        renderToStaticMarkup(<>{Children.map(children, (child) =>
          isValidElement(child) && (child.props as { plan?: ResumePagePlan }).plan
            ? cloneElement(child as ReactElement<{ plan: ResumePagePlan }>, { plan: firstPlan })
            : child,
        )}</>),
        profile, templateId, 1, totalPages, designSettings, resolvedCv,
      )
    : undefined;
  const html = applyManagedResumeOutput(
    renderToStaticMarkup(<>{children}</>),
    profile,
    templateId,
    pageNumber,
    totalPages,
    designSettings,
    resolvedCv,
    firstPageHtml,
  );
  return (
    <>
      <style>{managedResumeCss + templateStyles(templateId) + (templateId === "elegant" ? elegantManagedCss
        : templateId === "kreativ" ? kreativResolvedCss
        : templateId === "stilvoll" ? stilvollResolvedCss
        : templateId === "gepflegt" ? gepflegtResolvedCss : "")}</style>
      <div
        className="managed-resume-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
