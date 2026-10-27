import { act, createElement } from "react";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSaveShortcut } from "./useSaveShortcut";

const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
afterEach(() => Object.assign(globalThis, { window: previousWindow, document: previousDocument }));

/** A form behind the shortcut; `disabled` disables its fieldset as a section does while it saves. */
const mount = async (disabled = false) => {
  const { window } = parseHTML(`<html><body><div id="root"></div><form><fieldset${disabled ? " disabled" : ""}>
    <input name="title" /></fieldset></form></body></html>`);
  const form = window.document.querySelector("form")!;
  const requestSubmit = vi.fn();
  Object.assign(form, { requestSubmit });
  Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(window.document.getElementById("root")!);
  function Host() { useSaveShortcut(() => form as unknown as HTMLFormElement); return null; }
  await act(async () => { root.render(createElement(Host)); });
  const press = (init: Record<string, unknown>) => {
    const event = Object.assign(new window.Event("keydown", { cancelable: true }), init);
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { press, requestSubmit, unmount: () => act(async () => root.unmount()) };
};

describe("Strg+S", () => {
  it("submits the form with Strg+S and ⌘S, not with other keys, Alt/Shift or a held key", async () => {
    const view = await mount();
    expect(view.press({ key: "s", ctrlKey: true })).toBe(true);
    expect(view.press({ key: "S", metaKey: true })).toBe(true);
    view.press({ key: "s" });
    view.press({ key: "k", ctrlKey: true });
    view.press({ key: "s", ctrlKey: true, shiftKey: true });
    view.press({ key: "s", ctrlKey: true, altKey: true });
    view.press({ key: "s", ctrlKey: true, repeat: true });
    expect(view.requestSubmit).toHaveBeenCalledTimes(2);
    await view.unmount();
    view.press({ key: "s", ctrlKey: true });
    expect(view.requestSubmit).toHaveBeenCalledTimes(2);
  });

  it("leaves a section alone while it saves (its disabled fields would send no values)", async () => {
    const view = await mount(true);
    expect(view.press({ key: "s", ctrlKey: true })).toBe(true);
    expect(view.requestSubmit).not.toHaveBeenCalled();
    await view.unmount();
  });
});
