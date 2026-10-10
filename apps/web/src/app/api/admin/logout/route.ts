import { ADMIN_COOKIE } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` } },
  );
}
