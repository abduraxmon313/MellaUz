import { guardApi } from "@/lib/admin-auth";
import { json } from "@/lib/admin-api";
import { syncMirror } from "@/lib/manual-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bot bazasini sayt bazasi bilan to'liq tenglashtirish (masalan, bot bazasi keyin ulangan bo'lsa). */
export async function POST(req: Request) {
  const denied = guardApi(req);
  if (denied) return denied;
  try {
    return json({ ok: true, ...(await syncMirror()) });
  } catch (err) {
    console.error("[admin] sinxronlash xatosi:", err);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
}
