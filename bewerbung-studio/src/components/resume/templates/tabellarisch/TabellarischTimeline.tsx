/**
 * Tabellarisch Template - Timeline Component
 * Container for timeline entries (experience/education)
 */

import { TabellarischTimelineEntry } from "./TabellarischTimelineEntry";
import type { TabellarischTimelineProps } from "./tabellarisch.types";

export function TabellarischTimeline({
  items,
  atsMode,
  continuesOnNextPage = false,
}: TabellarischTimelineProps) {
  return (
    <div
      className="tabellarisch-timeline"
      data-continues-next-page={continuesOnNextPage}
    >
      {items.map((item) => (
        <TabellarischTimelineEntry
          key={item.id}
          {...item}
          atsMode={atsMode}
        />
      ))}
    </div>
  );
}
