import { guardApi } from "@/lib/admin-auth";
import { handleSave, json, refreshSite } from "@/lib/admin-api";
import { deleteManualProduct, isConfigured } from "@/lib/manual-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validId = (id: string) => /^m-[a-f0-9]{12}$/.test(id);

export async function PUT(req: Request, ctx: RouteContext<"/api/admin/products/[id]">) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!validId(id)) return json({ ok: false, error: "Mahsulot topilmadi" }, 404);
  if (!isConfigured()) return json({ ok: false, error: "DATABASE_URL sozlanmagan" }, 503);
  return handleSave(req, id);
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/products/[id]">) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!validId(id)) return json({ ok: false, error: "Mahsulot topilmadi" }, 404);
  try {
    const res = await deleteManualProduct(id);
    refreshSite();
    return json({ ok: true, ...res });
  } catch (err) {
    console.error("[admin] o'chirish xatosi:", err);
    return json({ ok: false, error: "O‘chirishda xato" }, 500);
  }
}
