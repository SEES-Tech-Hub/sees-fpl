export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-2 w-2 shrink-0 items-center justify-center ${className}`}
    >
      <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 [animation-duration:1.6s]" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
    </span>
  );
}
