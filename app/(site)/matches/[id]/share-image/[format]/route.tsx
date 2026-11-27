import { ImageResponse } from "next/og";
import { MATCH_SIZES, MatchCard } from "@/lib/design/og-match";
import { matchFonts, matchShareImage } from "@/lib/live/match-share-image";

// A match as a picture to download or share: /matches/<id>/share-image/post
// (1080×1350) or /story (1080×1920), with ?card=poster|live|goal|result|motm
// (lib/live/match-share.ts says which the match can have; the first is the
// default). Cached at the edge for 30 s, so a viral share costs one drawing
// per half minute; the match page adds the match's version to the address,
// so a new goal gets a new picture at once.

export async function GET(request: Request, { params }: { params: Promise<{ id: string; format: string }> }) {
  const { id, format } = await params;
  if (format !== "post" && format !== "story") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const [props, fonts] = await Promise.all([matchShareImage(url.origin, id, format, url.searchParams.get("card")), matchFonts()]);
  if (!props) return new Response("Not found", { status: 404 });
  return new ImageResponse(<MatchCard {...props} />, {
    ...MATCH_SIZES[format],
    fonts,
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" },
  });
}
