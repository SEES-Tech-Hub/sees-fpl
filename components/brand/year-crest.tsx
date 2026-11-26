import { CREST_CLASS, crestShape } from "@/lib/design/crest";
import { cn } from "@/lib/utils";

// A year's crest: its own shape in the year's colours with "Y3" in the middle.
//
//   variant "crest" (default): with the class ("SEES 29") on a ribbon. For
//     big places: match headers, the home hero, share-sized cards.
//   variant "mark": shape and "Y3" only. For rows and anything under ~48 px.
//   tone "light" (default) | "dark": on the app's green, the outer border is a
//     soft white instead of the year's darker shade.
//
// `size` is the height in px; the width follows the shape. Colours come from
// the --team-y* tokens, so nothing here is hard-coded. A side that isn't
// known yet (TBD) gets a plain grey circle with "?".

export function YearCrest({
  year,
  size = 28,
  variant = "mark",
  tone = "light",
  className,
  label,
}: {
  year: number | null | undefined;
  size?: number;
  variant?: "crest" | "mark";
  tone?: "light" | "dark";
  className?: string;
  /** Accessible name; defaults to "Year 3 crest". Pass "" when the name is written beside it. */
  label?: string;
}) {
  const known = !!year && year >= 1 && year <= 5;
  const shape = crestShape(year);
  const fill = known ? `var(--team-y${year})` : "var(--muted)";
  const ink = known ? `var(--team-y${year}-ink)` : "var(--border)";
  const border = tone === "dark" ? "var(--brand-foreground)" : ink;
  const borderOpacity = tone === "dark" ? 0.22 : 1;
  const text = known ? `Y${year}` : "?";
  const name = label ?? (known ? `Year ${year} crest` : "Team to be decided");
  const a11y = name ? { role: "img" as const, "aria-label": name } : { "aria-hidden": true as const };

  if (variant === "mark") {
    // Smaller marks get bolder borders and bigger type, so "Y3" stays readable.
    const inset = size >= 36 ? 0.86 : 0.8;
    const fontSize = size >= 36 ? 44 : 47;
    return (
      <svg
        viewBox="0 0 100 112"
        height={size}
        width={Math.round((size * 100) / 112)}
        className={cn("shrink-0", className)}
        {...a11y}
      >
        <path d={shape} style={{ fill: border }} opacity={borderOpacity} />
        <path d={shape} style={{ fill }} transform={`translate(50 56) scale(${inset}) translate(-50 -56)`} />
        <text
          x="50"
          y={size >= 36 ? 74 : 75}
          textAnchor="middle"
          className="font-heading"
          fontWeight={700}
          fontSize={fontSize}
          letterSpacing={-1.5}
          style={{ fill: "var(--team-foreground)" }}
        >
          {text}
        </text>
      </svg>
    );
  }

  const cls = known ? CREST_CLASS[year!] : "";
  return (
    <svg viewBox="0 0 120 124" height={size} width={Math.round((size * 120) / 124)} className={cn("shrink-0", className)} {...a11y}>
      <g transform="translate(10 4)">
        <path d={shape} style={{ fill: border }} opacity={borderOpacity} />
        <path d={shape} style={{ fill }} transform="translate(50 56) scale(0.88) translate(-50 -56)" />
        {tone === "light" && (
          <path
            d={shape}
            fill="none"
            stroke="white"
            strokeWidth={1.4}
            opacity={0.45}
            transform="translate(50 56) scale(0.8) translate(-50 -56)"
          />
        )}
        {known && (
          <>
            <path
              d="M30 36 H41 L46 31 H54 L59 36 H70"
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.5}
              style={{ stroke: "var(--team-foreground)" }}
            />
            <circle cx="27.5" cy="36" r="2.3" fill="none" strokeWidth={2} opacity={0.5} style={{ stroke: "var(--team-foreground)" }} />
            <circle cx="72.5" cy="36" r="2.3" fill="none" strokeWidth={2} opacity={0.5} style={{ stroke: "var(--team-foreground)" }} />
            <text
              x="51.6"
              y="71.1"
              textAnchor="middle"
              className="font-heading"
              fontWeight={700}
              fontSize={32}
              letterSpacing={-0.5}
              opacity={0.55}
              style={{ fill: ink }}
            >
              {text}
            </text>
          </>
        )}
        <text
          x="50"
          y={known ? 69.5 : 72}
          textAnchor="middle"
          className="font-heading"
          fontWeight={700}
          fontSize={known ? 32 : 40}
          letterSpacing={-0.5}
          style={{ fill: "var(--team-foreground)" }}
        >
          {text}
        </text>
      </g>
      {known && (
        <>
          <path d="M6 90 H22 V107 H6 L11.5 98.5 Z" style={{ fill: "var(--brand)" }} />
          <path d="M6 90 H22 V107 H6 L11.5 98.5 Z" fill="black" opacity={0.35} />
          <path d="M114 90 H98 V107 H114 L108.5 98.5 Z" style={{ fill: "var(--brand)" }} />
          <path d="M114 90 H98 V107 H114 L108.5 98.5 Z" fill="black" opacity={0.35} />
          <rect x="16" y="86" width="88" height="17" rx="1.5" style={{ fill: tone === "dark" ? "var(--team-foreground)" : "var(--brand)" }} />
          <path d="M16 103 L22 107 V103 Z" fill="black" opacity={0.4} />
          <path d="M104 103 L98 107 V103 Z" fill="black" opacity={0.4} />
          <text
            x="60"
            y="98.3"
            textAnchor="middle"
            className="font-heading"
            fontWeight={600}
            fontSize={11}
            letterSpacing={1.6}
            style={{ fill: "var(--brand-light)" }}
          >
            {cls}
          </text>
        </>
      )}
    </svg>
  );
}
