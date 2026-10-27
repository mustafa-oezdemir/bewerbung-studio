import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { scrollPanel } from "./scrollPanel";

/**
 * „Nach oben“ (left) and „Nach unten“ (right) as round buttons that stay on the bottom edge of a long panel while it
 * scrolls. Placed as the panel's last child; the middle holds what the panel keeps in reach (its save button or status).
 */
export function ScrollJumpButtons({ panel, children }: { panel: RefObject<HTMLElement | null>; children?: ReactNode }) {
  return (
    <div className="scroll-jump">
      <button type="button" className="scroll-jump__button" aria-label="Nach oben" title="Nach oben"
        onClick={() => scrollPanel(panel.current, "top")}>
        <ChevronUp size={22} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <div className="scroll-jump__middle">{children}</div>
      <button type="button" className="scroll-jump__button" aria-label="Nach unten" title="Nach unten"
        onClick={() => scrollPanel(panel.current, "bottom")}>
        <ChevronDown size={22} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
