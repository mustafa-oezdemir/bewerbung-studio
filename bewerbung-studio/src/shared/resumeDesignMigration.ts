import type { DocumentDesignSettings } from "./documentDesign";
import { applyGlobalResumeDesign, compactResumeDesignLayer } from "./resumeDesignSystem";
import type { Workspace } from "./schema";

/**
 * Every Bewerbung carries its own Lebenslauf design; there is no workspace-wide design any more. An older workspace
 * may still hold one (`settings.resumeDesign`): it is folded once into every application exactly as the outputs used
 * to fold it (below the application's own values, which keep precedence), into the active template's settings and
 * into the saved designs of its other templates. Afterwards the shared layer is gone, so every Bewerbung looks as
 * before but is independent of the others, and new ones start from the template's own values.
 *
 * Pure and idempotent: a workspace without a shared layer comes back unchanged (the very same object).
 */
export function migrateGlobalResumeDesign(workspace: Workspace): Workspace {
  if (!workspace.settings.resumeDesign) return workspace;
  const layer = compactResumeDesignLayer(workspace.settings.resumeDesign);
  const { resumeDesign: _legacy, ...settings } = workspace.settings;
  if (!layer) return { ...workspace, settings };
  return {
    ...workspace,
    settings,
    applications: workspace.applications.map((application) => ({
      ...application,
      designSettings: applyGlobalResumeDesign(application.designSettings, layer),
      templateDesigns: Object.fromEntries(
        Object.entries(application.templateDesigns).map(([templateId, saved]) => [
          templateId,
          // A saved template design only names the fields it changes; the shared layer is folded in below them.
          { ...saved, settings: applyGlobalResumeDesign(saved.settings as DocumentDesignSettings, layer) as typeof saved.settings },
        ]),
      ),
    })),
  };
}
