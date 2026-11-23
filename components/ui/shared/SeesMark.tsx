// components/shared/SeesMark.tsx
interface SeesMarkProps {
  className?: string;
}

export function SeesMark({ className = "h-6 w-6" }: SeesMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {/* Outer circuit traces & nodes */}
      <path
        d="M6 10 H12 L15 13 M26 22 H20 L17 19 M16 4 V11 M16 28 V21"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5.5" cy="10" r="2" fill="currentColor" />
      <circle cx="26.5" cy="22" r="2" fill="currentColor" />
      <circle cx="16" cy="4" r="2" fill="currentColor" />
      <circle cx="16" cy="28" r="2" fill="currentColor" />
      {/* SEES centre node */}
      <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="2.25" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}
