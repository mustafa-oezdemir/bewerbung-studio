export function IvyLeagueBackground() {
  return (
    <svg
      className="ivy-league-background"
      data-element-id="ivy-league.background"
      viewBox="0 0 210 297"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter
          id="ivy-watercolor"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.025"
            numOctaves="3"
            seed="17"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="B"
          />
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
        <linearGradient id="ivy-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef9f8" />
          <stop offset=".48" stopColor="#fbfdf9" />
          <stop offset="1" stopColor="#fff8e9" />
        </linearGradient>
      </defs>
      <rect width="210" height="297" fill="url(#ivy-paper)" />
      <g filter="url(#ivy-watercolor)" opacity=".52">
        <path
          d="M-18 4C18-9 48 1 73 24c16 15 15 38-4 55-25 23-63 30-91 12z"
          fill="#d9f1f4"
        />
        <path
          d="M123-15c34 4 78 1 106 30v59c-34 7-79-8-97-31-13-17-15-38-9-58z"
          fill="#fff1d8"
        />
        <path
          d="M-12 93c38-20 81-12 101 17 20 28-3 56-42 62-28 5-52-2-66-20z"
          fill="#e3f5ed"
        />
        <path
          d="M133 85c31-12 74 1 91 28v67c-23 14-68 4-89-24-19-25-18-56-2-71z"
          fill="#e4f3f3"
        />
        <path
          d="M-20 191c28-18 65-18 89 7 24 26 19 58-8 78-22 16-55 15-81 3z"
          fill="#e9f6f4"
        />
        <path
          d="M93 185c34-24 83-20 118 6 29 22 31 69 10 102H116c-24-22-42-78-23-108z"
          fill="#fff1d4"
        />
        <path
          d="M144 247c29-13 67 1 84 25v36h-89c-10-22-7-48 5-61z"
          fill="#d8f1f2"
        />
      </g>
    </svg>
  );
}
