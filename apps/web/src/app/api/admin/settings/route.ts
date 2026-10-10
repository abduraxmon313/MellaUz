import { guardApi } from "@/lib/admin-auth";
import { json, refreshSite } from "@/lib/admin-api";
import { saveSettings } from "@/lib/manual-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = guardApi(req);
  if (denied) return denied;
  let hideSamples = false;
  try {
    hideSamples = ((await req.json()) as { hideSamples?: unknown }).hideSamples === true;
  } catch {
    return json({ ok: false, error: "Noto‘g‘ri so‘rov" }, 400);
  }
  try {
    const res = await saveSettings({ hideSamples });
    refreshSite();
    return json({ ok: true, hideSamples, ...res });
  } catch (err) {
    console.error("[admin] sozlama xatosi:", err);
    return json({ ok: false, error: "Saqlashda xato" }, 500);
  }
}
