import { guardApi } from "@/lib/admin-auth";
import { handleSave, json } from "@/lib/admin-api";
import { isConfigured } from "@/lib/manual-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Yangi mahsulot (multipart/form-data). */
export async function POST(req: Request) {
  const denied = guardApi(req);
  if (denied) return denied;
  if (!isConfigured()) return json({ ok: false, error: "DATABASE_URL sozlanmagan" }, 503);
  return handleSave(req, null);
}
