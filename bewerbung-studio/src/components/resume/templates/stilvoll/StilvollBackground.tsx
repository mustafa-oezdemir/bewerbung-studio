export function StilvollBackground() {
  return (
    <svg
      className="stilvoll-background"
      viewBox="0 0 210 297"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-element-id="stilvoll.background"
    >
      <defs>
        <pattern
          id="stilvoll-chevron"
          width="34"
          height="25"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0 22 17 6l17 16M0 16 17 0l17 16" />
        </pattern>
      </defs>
      <path d="M52 0h158v47c-27-2-47 4-61 18-17 17-42 20-69 2C60 52 49 30 52 0Z" />
      <rect x="50" y="-5" width="160" height="105" fill="url(#stilvoll-chevron)" />
      <rect x="118" y="48" width="92" height="83" fill="url(#stilvoll-chevron)" />
    </svg>
  );
}
