import type { ReactNode } from "react";
import type { ZeitgenoessischIcon } from "./zeitgenoessisch.types";

const icons: Record<ZeitgenoessischIcon, ReactNode> = {
  contacts: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  strengths: (
    <path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
  ),
  languages: (
    <path d="M4 5h10M9 5c0 6-2 10-5 13M6 10c2 3 4 5 7 7M14 9h6M17 7v11M14 15h6" />
  ),
  summary: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
    </>
  ),
  experience: (
    <path d="M4 7h16v12H4zM9 7V4h6v3M4 12h16M10 12v2h4v-2" />
  ),
  education: (
    <path d="m3 9 9-5 9 5-9 5zM6 11v5c3 2 9 2 12 0v-5" />
  ),
  knowledge: (
    <path d="M12 3a6 6 0 0 0-3.5 10.9V18h7v-4.1A6 6 0 0 0 12 3ZM9 21h6" />
  ),
  certifications: (
    <path d="M7 4h10v16l-5-3-5 3zM9 8h6M9 11h6" />
  ),
};

export function ZeitgenoessischSectionHeading({
  title,
  icon,
  continuation = false,
}: {
  title: string;
  icon: ZeitgenoessischIcon;
  continuation?: boolean;
}) {
  return (
    <header className="zeitgenoessisch-section-heading">
      <span
        className="zeitgenoessisch-section-heading__icon"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          {icons[icon]}
        </svg>
      </span>
      <h2 className="zeitgenoessisch-section-heading__title">
        {title}
        {continuation ? <small>Fortsetzung</small> : null}
      </h2>
    </header>
  );
}
