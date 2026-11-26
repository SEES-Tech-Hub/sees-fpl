import { teamColour } from "@/lib/design/team-colour";

// Owner: Fortune (design kit). A small tilted pitch for the next-match card:
// both sides lined up in a 4-4-2 in their year colours, with a ball rolling
// between them. Decorative only (aria-hidden); still for reduced motion.

const SHAPE: [number, number][] = [
  [6, 50], [20, 18], [20, 39], [20, 61], [20, 82], [33, 14], [33, 38], [33, 62], [33, 86], [44, 36], [44, 64],
];

export function Pitch3D({ homeYear, awayYear }: { homeYear?: number | null; awayYear?: number | null }) {
  const players = [
    ...SHAPE.map(([x, y]) => ({ x, y, c: teamColour(homeYear) })),
    ...SHAPE.map(([x, y]) => ({ x: 100 - x, y: 100 - y, c: teamColour(awayYear) })),
  ];
  return (
    <div aria-hidden className="h-36 w-full [perspective:700px] sm:h-40">
      <div
        className="relative h-40 w-full origin-bottom rounded-md shadow-[0_30px_30px_-20px_rgb(0_0_0/0.6)] [transform:rotateX(52deg)_translateY(-28px)] [transform-style:preserve-3d] sm:h-44"
        style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--grass-1) 0 10%, var(--grass-2) 10% 20%)" }}
      >
        <span className="absolute inset-0 rounded-md ring-2 ring-grass-line ring-inset" />
        <span className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-grass-line" />
        <span className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-grass-line" />
        <span className="absolute top-[28%] bottom-[28%] left-0 w-[11%] border-2 border-l-0 border-grass-line" />
        <span className="absolute top-[28%] right-0 bottom-[28%] w-[11%] border-2 border-r-0 border-grass-line" />
        {players.map((p, i) => (
          <span
            key={i}
            className="absolute h-4 w-[7px] origin-bottom rounded-t-[3px] rounded-b-[1px] [transform:translate(-50%,-100%)_rotateX(-52deg)]"
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.c }}
          />
        ))}
        <span className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-on-pitch motion-safe:animate-[sees-roll_6s_ease-in-out_infinite]" style={{ left: "50%", top: "50%" }} />
      </div>
    </div>
  );
}
