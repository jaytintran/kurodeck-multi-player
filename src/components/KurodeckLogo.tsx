interface KurodeckLogoProps {
  className?: string;
}

export function KurodeckLogo({ className = 'w-7 h-7' }: KurodeckLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        width="64"
        height="64"
        rx="12"
        fill="#0D121D"
        stroke="#253047"
        strokeWidth="2"
      />
      <rect
        x="11"
        y="11"
        width="18.5"
        height="18.5"
        rx="2.5"
        fill="#141C2B"
        stroke="#64748B"
        strokeWidth="2"
      />
      <rect
        x="34.5"
        y="11"
        width="18.5"
        height="18.5"
        rx="2.5"
        fill="#141C2B"
        stroke="#64748B"
        strokeWidth="2"
      />
      <rect
        x="11"
        y="34.5"
        width="18.5"
        height="18.5"
        rx="2.5"
        fill="#141C2B"
        stroke="#64748B"
        strokeWidth="2"
      />
      <rect
        x="34.5"
        y="34.5"
        width="18.5"
        height="18.5"
        rx="2.5"
        fill="#141C2B"
        stroke="#64748B"
        strokeWidth="2"
      />
      <path
        d="M10 32H21L24.5 36.5L28 24.5L32 16.5L35.5 44.5L39 26.5L42.5 36L45.5 32H54"
        stroke="#07090E"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 32H21L24.5 36.5L28 24.5L32 16.5L35.5 44.5L39 26.5L42.5 36L45.5 32H54"
        stroke="#06E5F5"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
