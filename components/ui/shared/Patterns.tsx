export function CircuitTrace({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full text-brand-light opacity-15 ${className}`}
      xmlns="http://w3.org"
    >
      <defs>
        <pattern id="sees-circuit" width="120" height="120" patternUnits="userSpaceOnUse">
          <path
            d="M0 30 H40 L55 45 H95 M25 120 V80 L40 65 V20 M80 0 V35 L95 50 H120"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <circle cx="40" cy="30" r="2.5" fill="currentColor" />
          <circle cx="95" cy="45" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <circle cx="25" cy="80" r="2.5" fill="currentColor" />
          <circle cx="80" cy="35" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sees-circuit)" />
    </svg>
  );
}

export function Grain({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay ${className}`}
      xmlns="http://w3.org"
    >
      <filter id="sees-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#sees-grain)" />
    </svg>
  );
}
