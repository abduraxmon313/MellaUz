import { config } from "./config.js";
import { store } from "./store.js";

/**
 * Adminlar ro'yxati.
 *  • Egalar (owner) — ADMIN_IDS env'dagilar. Ularni bot orqali o'chirib bo'lmaydi;
 *    faqat ular yangi admin qo'sha / olib tashlay oladi.
 *  • Qo'shilgan adminlar — admin botda egasi qo'shgan, bazada (kv) saqlanadi. Server qayta
 *    ishga tushganda ham saqlanib qoladi. Buyurtmalar va mahsulotlar bilan ishlay oladi.
 */

export interface ExtraAdmin {
  id: number;
  name: string;
  username: string;
  addedBy: number;
  addedAt: string;
}

const KV_KEY = "admin_extra";
let extra: ExtraAdmin[] = [];

export async function loadAdmins() {
  try {
    const v = await store.kvGet<ExtraAdmin[]>(KV_KEY);
    extra = Array.isArray(v) ? v.filter((x) => x && Number.isFinite(Number(x.id))).map((x) => ({ ...x, id: Number(x.id) })) : [];
  } catch (e) {
    console.warn("[admins] ro'yxat o'qilmadi:", (e as Error).message);
  }
}

export const isOwner = (id: number | undefined) => Boolean(id && config.adminIds.includes(id));
export const isAdmin = (id: number | undefined) => Boolean(id && (isOwner(id) || extra.some((x) => x.id === id)));

/** Buyurtma kartalari yuboriladigan barcha adminlar. */
export function allAdminIds(): number[] {
  return [...new Set([...config.adminIds, ...extra.map((x) => x.id)])];
}

export function listExtraAdmins(): ExtraAdmin[] {
  return [...extra];
}

/** true — yangi qo'shildi; false — allaqachon admin. */
export async function addAdmin(a: Omit<ExtraAdmin, "addedAt">): Promise<boolean> {
  if (isAdmin(a.id)) return false;
  const next = [...extra, { ...a, addedAt: new Date().toISOString() }];
  await store.kvSet(KV_KEY, next);
  extra = next;
  return true;
}

export async function removeAdmin(id: number): Promise<boolean> {
  if (!extra.some((x) => x.id === id)) return false;
  const next = extra.filter((x) => x.id !== id);
  await store.kvSet(KV_KEY, next);
  extra = next;
  return true;
}
