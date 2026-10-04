import type { CSSProperties } from "react";
import {
  getReadableTextColor,
  type TemplateDefinition,
} from "../shared/templates";

type Props = {
  template: TemplateDefinition;
  accent?: string;
  secondary?: string;
  className?: string;
};

export function TemplateThumbnail({
  template,
  accent = template.accent,
  secondary = template.secondary,
  className = "",
}: Props) {
  return (
    <span
      aria-hidden="true"
      data-template={template.id}
      className={`template-thumbnail template-layout-${template.layout} ${className}`.trim()}
      style={
        {
          "--template-accent": accent,
          "--template-secondary": secondary,
          "--template-on-secondary": getReadableTextColor(secondary),
        } as CSSProperties
      }>
      {template.id === "pehlione_white_blue" ||
      template.id === "pehlione_white" ? (
        <>
          <span className="pehlione-thumbnail-hero" />
          <span className="pehlione-thumbnail-sidebar" />
          <span className="pehlione-thumbnail-content" />
        </>
      ) : null}
      <span className="thumbnail-header">
        <b />
        <i />
        <em />
      </span>
      <span className="thumbnail-main">
        <b />
        <i />
        <i />
        <i />
        <b />
        <i />
        <i />
      </span>
      <span className="thumbnail-side">
        <strong />
        <b />
        <i />
        <i />
        <b />
        <i />
        <i />
      </span>
    </span>
  );
}
