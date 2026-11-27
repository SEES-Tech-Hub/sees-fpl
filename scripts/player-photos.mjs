// Copies cropped player photos into public/players/<player id>.webp and
// rewrites lib/fantasy/player-photos.ts, the list of players who have one.
//
//   node --env-file=.env.local scripts/player-photos.mjs <crops folder> <mapping.json>
//
// <crops folder> holds y2/, y3/… with one .webp per photo (the face crops).
// <mapping.json> maps "y3/ANIXS" → { "year": 3, "name": "Anix" } (a player's
// display name). Photos are named by player id because names repeat across
// years (there's an Atom in Year 3 and in Year 4).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const [cropDir, mappingFile] = process.argv.slice(2);
if (!cropDir || !mappingFile) {
  console.error("Usage: node --env-file=.env.local scripts/player-photos.mjs <crops folder> <mapping.json>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
const { data: players, error } = await supabase.from("players").select("id, display_name, team:teams(year)");
if (error) throw error;

const mapping = JSON.parse(readFileSync(mappingFile, "utf8"));
const outDir = "public/players";
mkdirSync(outDir, { recursive: true });

const ids = [];
const problems = [];
for (const [file, { year, name }] of Object.entries(mapping)) {
  const matches = players.filter((p) => p.team?.year === year && p.display_name === name);
  if (matches.length !== 1) {
    problems.push(`${file}: ${matches.length} players called "${name}" in Year ${year}`);
    continue;
  }
  const src = join(cropDir, `${file}.webp`);
  if (!existsSync(src)) {
    problems.push(`${file}: no crop at ${src}`);
    continue;
  }
  copyFileSync(src, join(outDir, `${matches[0].id}.webp`));
  ids.push(matches[0].id);
}

ids.sort();
writeFileSync(
  "lib/fantasy/player-photos.ts",
  `// Players with a photo in public/players/<id>.webp. Written by
// scripts/player-photos.mjs; don't edit by hand.
export const PLAYER_PHOTO_IDS: ReadonlySet<string> = new Set([
${ids.map((id) => `  "${id}",`).join("\n")}
]);

export const playerPhotoUrl = (id: string) => (PLAYER_PHOTO_IDS.has(id) ? \`/players/\${id}.webp\` : null);
`,
);
console.log(`${ids.length} photos written`);
if (problems.length) {
  console.log("Problems:\n" + problems.join("\n"));
  process.exit(1);
}
