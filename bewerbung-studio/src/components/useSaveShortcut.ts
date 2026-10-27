import { useEffect, useRef } from "react";

/**
 * Strg+S (⌘S on macOS) submits the form `pick` returns, as clicking its save button does. A form whose fields are
 * disabled while it saves is left alone: submitted then, it would send no values.
 */
export const useSaveShortcut = (pick: () => HTMLFormElement | null | undefined) => {
  const latestPick = useRef(pick);
  useEffect(() => { latestPick.current = pick; });
  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key?.toLowerCase() !== "s") return;
      event.preventDefault();
      const form = event.repeat ? null : latestPick.current();
      if (form && !form.querySelector("fieldset:disabled")) form.requestSubmit();
    };
    window.addEventListener("keydown", save);
    return () => window.removeEventListener("keydown", save);
  }, []);
};
