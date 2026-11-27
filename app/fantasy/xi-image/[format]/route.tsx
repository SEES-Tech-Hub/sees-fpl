import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { XI_SIZES, XiImage, type XiFormat } from "@/lib/design/og-xi";
import { myXiImage } from "@/lib/fantasy/xi-image";

// The signed-in manager's starting XI as a picture to download or share:
// /fantasy/xi-image/post (1080×1350) or /story (1080×1920). Made fresh on
// every request from their saved lineup; only ever their own team.

export async function GET(request: Request, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  if (format !== "post" && format !== "story") return new Response("Not found", { status: 404 });
  await connection();
  const data = await myXiImage(new URL(request.url).origin);
  if (!data) return new Response("No team", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new ImageResponse(<XiImage format={format as XiFormat} {...data} />, {
    ...XI_SIZES[format as XiFormat],
    headers: { "Cache-Control": "private, no-store" },
  });
}
