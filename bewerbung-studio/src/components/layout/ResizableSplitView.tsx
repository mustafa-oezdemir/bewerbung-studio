import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export const DEFAULT_SPLIT_RATIO = 0.42;
export const SPLITTER_SIZE = 8;
const KEYBOARD_STEP = 10;
const LARGE_KEYBOARD_STEP = 40;

export function getSplitRatioBounds(
  workspaceWidth: number,
  minPrimary: number,
  minSecondary: number,
  splitterSize = SPLITTER_SIZE,
) {
  const availableWidth = Math.max(0, workspaceWidth - splitterSize);
  if (availableWidth < minPrimary + minSecondary) {
    return { min: 0, max: 1 };
  }

  return {
    min: minPrimary / availableWidth,
    max: 1 - minSecondary / availableWidth,
  };
}

export function clampSplitRatio(
  ratio: number,
  workspaceWidth: number,
  minPrimary: number,
  minSecondary: number,
  splitterSize = SPLITTER_SIZE,
) {
  const bounds = getSplitRatioBounds(
    workspaceWidth,
    minPrimary,
    minSecondary,
    splitterSize,
  );
  return Math.min(bounds.max, Math.max(bounds.min, ratio));
}

export function readSplitRatio(persistKey: string, fallback: number) {
  if (typeof window === "undefined") return fallback;

  try {
    const value = Number.parseFloat(
      window.localStorage.getItem(`bewerbungsmanager.split.${persistKey}`) ?? "",
    );
    return Number.isFinite(value) && value > 0 && value < 1 ? value : fallback;
  } catch {
    return fallback;
  }
}

type ResizableSplitViewProps = {
  primary: ReactNode;
  secondary: ReactNode;
  defaultRatio?: number;
  minPrimary?: number;
  minSecondary?: number;
  persistKey: string;
  className?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
};

/**
 * A reusable, desktop-first split workspace. On narrow containers CSS falls
 * back to a stacked layout, while the preferred desktop ratio is preserved.
 */
export function ResizableSplitView({
  primary,
  secondary,
  defaultRatio = DEFAULT_SPLIT_RATIO,
  minPrimary = 500,
  minSecondary = 450,
  persistKey,
  className = "",
  primaryLabel = "Editor",
  secondaryLabel = "Vorschau",
}: ResizableSplitViewProps) {
  const workspaceRef = useRef<HTMLElement>(null);
  const cleanupResizeRef = useRef<(() => void) | null>(null);
  const [ratio, setRatio] = useState(() =>
    readSplitRatio(persistKey, defaultRatio),
  );
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);

  const isCompact =
    workspaceWidth > 0 &&
    workspaceWidth < minPrimary + minSecondary + SPLITTER_SIZE;

  const setClampedRatio = (nextRatio: number, width = workspaceWidth) => {
    setRatio(
      clampSplitRatio(
        nextRatio,
        width,
        minPrimary,
        minSecondary,
        SPLITTER_SIZE,
      ),
    );
  };

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const updateWidth = () => setWorkspaceWidth(workspace.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `bewerbungsmanager.split.${persistKey}`,
        String(ratio),
      );
    } catch {
      // A disabled localStorage must not prevent editing a document.
    }
  }, [persistKey, ratio]);

  useEffect(
    () => () => {
      cleanupResizeRef.current?.();
    },
    [],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (isCompact || event.button !== 0) return;
    event.preventDefault();

    const splitter = event.currentTarget;
    const pointerId = event.pointerId;
    splitter.setPointerCapture?.(pointerId);
    document.body.classList.add("is-resizing-split-view");
    setIsResizing(true);

    const updateFromPointer = (clientX: number) => {
      const workspace = workspaceRef.current;
      if (!workspace) return;
      const bounds = workspace.getBoundingClientRect();
      const availableWidth = Math.max(1, bounds.width - SPLITTER_SIZE);
      setClampedRatio((clientX - bounds.left) / availableWidth, bounds.width);
    };

    let moveResize: (moveEvent: PointerEvent) => void;
    const finishResize = () => {
      splitter.releasePointerCapture?.(pointerId);
      document.body.classList.remove("is-resizing-split-view");
      setIsResizing(false);
      window.removeEventListener("pointermove", moveResize);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      cleanupResizeRef.current = null;
    };

    moveResize = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      updateFromPointer(moveEvent.clientX);
    };

    cleanupResizeRef.current?.();
    cleanupResizeRef.current = finishResize;
    window.addEventListener("pointermove", moveResize, { passive: false });
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
    updateFromPointer(event.clientX);
  };

  const handleKeyboardResize = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (isCompact) return;
    const workspace = workspaceRef.current;
    const width = workspace?.clientWidth ?? workspaceWidth;
    const availableWidth = Math.max(1, width - SPLITTER_SIZE);
    const step = (event.shiftKey ? LARGE_KEYBOARD_STEP : KEYBOARD_STEP) /
      availableWidth;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setClampedRatio(ratio - step, width);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setClampedRatio(ratio + step, width);
    } else if (event.key === "Home") {
      event.preventDefault();
      setClampedRatio(0, width);
    } else if (event.key === "End") {
      event.preventDefault();
      setClampedRatio(1, width);
    }
  };

  const splitBounds = getSplitRatioBounds(
    workspaceWidth,
    minPrimary,
    minSecondary,
  );
  const ratioPercentage = Math.round(ratio * 100);
  const style = {
    "--split-primary-width": `calc(${ratio * 100}% - ${ratio * SPLITTER_SIZE}px)`,
    "--split-min-primary": `${minPrimary}px`,
    "--split-min-secondary": `${minSecondary}px`,
  } as CSSProperties;

  return (
    <section
      className={`resizable-split-view ${isResizing ? "is-resizing" : ""} ${className}`}
      ref={workspaceRef}
      style={style}>
      <div className="resizable-split-view__primary" aria-label={primaryLabel}>
        {primary}
      </div>
      <button
        aria-label={`${primaryLabel} und ${secondaryLabel} in der Breite anpassen. Doppelklick setzt 42 zu 58 zurück.`}
        aria-orientation="vertical"
        aria-valuemax={Math.round(splitBounds.max * 100)}
        aria-valuemin={Math.round(splitBounds.min * 100)}
        aria-valuenow={ratioPercentage}
        className="resizable-split-view__separator"
        disabled={isCompact}
        onDoubleClick={() => setClampedRatio(defaultRatio)}
        onKeyDown={handleKeyboardResize}
        onPointerDown={handlePointerDown}
        role="separator"
        tabIndex={isCompact ? -1 : 0}
        type="button"
      />
      <div className="resizable-split-view__secondary" aria-label={secondaryLabel}>
        {secondary}
      </div>
    </section>
  );
}
