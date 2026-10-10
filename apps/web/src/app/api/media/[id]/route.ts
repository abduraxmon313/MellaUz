import { getManualImage } from "@/lib/manual-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin panelda yuklangan mahsulot rasmlari (bazadan). ID har yuklashda yangi — uzoq kesh xavfsiz. */
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{32}$/.test(id)) return new Response(null, { status: 404 });
  const img = await getManualImage(id).catch(() => null);
  if (!img) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
