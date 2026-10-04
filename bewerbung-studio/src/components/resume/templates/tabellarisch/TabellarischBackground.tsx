export function TabellarischBackground() {
  return (
    <svg
      aria-hidden="true"
      className="tabellarisch-background"
      preserveAspectRatio="xMidYMin slice"
      viewBox="0 0 1000 260"
    >
      <defs>
        <pattern
          id="tabellarisch-cube-grid"
          width="144"
          height="84"
          patternUnits="userSpaceOnUse"
        >
          <path d="M72 0 144 42 72 84 0 42 72 0v84M0 42l72 42 72-42" />
        </pattern>
        <linearGradient id="tabellarisch-cube-fade" x1="0" x2="1">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset=".25" stopColor="white" stopOpacity=".45" />
          <stop offset=".48" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id="tabellarisch-cube-mask">
          <rect width="1000" height="260" fill="url(#tabellarisch-cube-fade)" />
        </mask>
      </defs>
      <rect
        x="210"
        y="-44"
        width="850"
        height="310"
        fill="url(#tabellarisch-cube-grid)"
        mask="url(#tabellarisch-cube-mask)"
      />
    </svg>
  );
}
