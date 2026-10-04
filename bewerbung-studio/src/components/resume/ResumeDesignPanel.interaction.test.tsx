import { act, useState } from "react";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it } from "vitest";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import {
  createDocumentDesignDraft, editCvDesignField, editResumeAppearanceField, type DesignEditState,
} from "../../shared/documentEditorState";
import { resolveResumeDesignView } from "../../shared/resumeDesignSystem";
import type { Application } from "../../shared/schema";
import { ResumeDesignPanel } from "./ResumeDesignPanel";

const application = {
  id: "00000000-0000-4000-8000-000000000001", templateId: "klassisch", accentColor: "#123456",
  secondaryColor: "#234567", designSettings: getTemplateDocumentDesignDefaults("klassisch"), templateDesigns: {},
} as Application;

const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
const previousActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;

afterEach(() => {
  Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: previousActEnvironment });
});

describe("real React design input events", () => {
  it("keeps decimal and HEX drafts during live updates and writes consecutive fields", async () => {
    const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(window.document.getElementById("root")!);
    function Harness() {
      const [state, setState] = useState<DesignEditState>(() => ({ draft: createDocumentDesignDraft(application), global: undefined }));
      const view = resolveResumeDesignView("klassisch", state.draft.settings, state.global);
      return <>
        <output id="body-size">{view.effective.tokens.typography.bodySizePt}</output>
        <output id="line-height">{view.effective.tokens.typography.lineHeight}</output>
        <output id="text-color">{view.effective.tokens.colors.text}</output>
        <ResumeDesignPanel documentId={application.id} templateId="klassisch" templateName="Klassisch" settings={state.draft.settings} global={state.global} hasSidebar
          onEditToken={(scope, group, key, value) => setState((current) => editCvDesignField(current, scope, group, key as never, value as never))}
          onEditAppearance={(scope, key, value) => setState((current) => editResumeAppearanceField(current, scope, key, value as never))}
          onPreset={() => undefined} onReset={() => undefined} />
      </>;
    }
    await act(async () => { root.render(<Harness />); });
    const input = (label: string) => window.document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    const send = async (label: string, value: string) => {
      const element = input(label);
      element.value = value;
      await act(async () => { element.dispatchEvent(new window.Event("input", { bubbles: true })); });
      return element;
    };
    expect((await send("Lesetext (pt)", "12,5")).value).toBe("12,5");
    expect(window.document.getElementById("body-size")?.textContent).toBe("12.5");
    expect((await send("Lesetext (pt)", "12,")).value).toBe("12,");
    expect(window.document.getElementById("body-size")?.textContent).toBe("12.5");
    expect((await send("Lesetext (pt)", "12,8")).value).toBe("12,8");
    expect(window.document.getElementById("body-size")?.textContent).toBe("12.8");
    await send("Zeilenhöhe", "1,35");
    expect(window.document.getElementById("line-height")?.textContent).toBe("1.35");
    await send("Lesetext HEX", "#12");
    expect(window.document.getElementById("text-color")?.textContent).not.toBe("#12");
    await send("Lesetext HEX", "#123ABC");
    expect(window.document.getElementById("text-color")?.textContent).toBe("#123ABC");
    await act(async () => { root.unmount(); });
  });
});
