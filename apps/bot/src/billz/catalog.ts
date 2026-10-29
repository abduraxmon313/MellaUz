import { config } from "../config.js";
import type { Category } from "../catalog/types.js";
import { billz } from "./client.js";

/**
 * BILLZ katalogi — YANGI yondashuv:
 *
 * Eski holat: 23 000+ mahsulotni birdaniga yuklab, xotirada saqlash → BILLZ 500/timeout.
 *
 * Yangi holat:
 *  • Kategoriyalar bir marta yuklanadi (ular kam) va xotirada saqlanadi.
 *  • Mahsulotlar BILLZ'dan to'g'ridan-to'g'ri sahifalab olinadi (foydalanuvchi
 *    scroll qilsa — keyingi sahifa). Xotirada saqlanmaydi.
 *  • Do'konlar ro'yxati bir marta yuklanadi.
 */

// ── Tiplar ──────────────────────────────────────────────────

interface BillzCategoryRef { id: string; name: string; parent_id?: string }

interface BillzCategoryNode {
  id: string; name: string; parent_id?: string;
  subRows?: BillzCategoryNode[] | null;
  product_count?: number;
}

export interface BillzShop { id: string; name: string }

export interface BillzProductRaw {
  id: string;
  name: string;
  base_name?: string;
  sku?: string;
  barcode?: string;
  brand_name?: string;
  description?: string;
  is_variative?: boolean;
  parent_id?: string;
  main_image_url?: string;
  photos?: { photo_url: string; sequence?: number; is_main?: boolean }[] | null;
  categories?: BillzCategoryRef[] | null;
  product_attributes?: { attribute_name?: string; attribute_value?: string }[] | null;
  product_type_id?: string;
  shop_measurement_values?: { shop_id: string; active_measurement_value: number | string }[] | null;
  shop_prices?: {
    shop_id: string; retail_price: number; retail_currency?: string;
    promo_price?: number; promos?: unknown[] | null;
  }[] | null;
  updated_at?: string;
}

// ── Yordamchi funksiyalar ───────────────────────────────────

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

function shopAllowed(shopId: string) {
  return config.billz.shopIds.length === 0 || config.billz.shopIds.includes(shopId);
}

export function priceOf(p: BillzProductRaw, shopId?: string): { price: number; oldPrice: number | null } {
  const prices = (p.shop_prices ?? []).filter((x) => n(x.retail_price) > 0);
  let sp: (typeof prices)[number] | undefined;
  if (shopId) {
    sp = prices.find((x) => x.shop_id === shopId);
  } else {
    for (const id of config.billz.shopIds) { sp = prices.find((x) => x.shop_id === id); if (sp) break; }
    sp ??= prices[0];
  }
  if (!sp) return { price: 0, oldPrice: null };
  const retail = Math.round(n(sp.retail_price));
  const promo = Math.round(n(sp.promo_price));
  if (Array.isArray(sp.promos) && sp.promos.length > 0 && promo > 0 && promo < retail) {
    return { price: promo, oldPrice: retail };
  }
  return { price: retail, oldPrice: null };
}

export function stockOf(p: BillzProductRaw, shopId?: string): number {
  if (shopId) {
    const s = (p.shop_measurement_values ?? []).find((x) => x.shop_id === shopId);
    return s ? Math.max(0, n(s.active_measurement_value)) : 0;
  }
  return (p.shop_measurement_values ?? [])
    .filter((s) => shopAllowed(s.shop_id))
    .reduce((sum, s) => sum + Math.max(0, n(s.active_measurement_value)), 0);
}

export function photosOf(p: BillzProductRaw): string[] {
  const list = [...(p.photos ?? [])]
    .filter((x) => x && x.photo_url)
    .sort((a, b) => Number(Boolean(b.is_main)) - Number(Boolean(a.is_main)) || n(a.sequence) - n(b.sequence))
    .map((x) => x.photo_url);
  if (p.main_image_url && !list.includes(p.main_image_url)) list.unshift(p.main_image_url);
  return list;
}

export function variantLabel(p: BillzProductRaw, baseName: string): string {
  const attrs = (p.product_attributes ?? []).map((a) => String(a.attribute_value ?? "").trim()).filter(Boolean);
  if (attrs.length) return attrs.join(" / ");
  if (baseName && p.name.startsWith(baseName)) return p.name.slice(baseName.length).replace(/^[\s/|-]+/, "").trim();
  return "";
}

// ── Kategoriya daraxti ──────────────────────────────────────

function buildTopLevelMap(tree: BillzCategoryNode[]) {
  const top = new Map<string, { id: string; name: string }>();
  const order: { id: string; name: string }[] = [];
  const walk = (node: BillzCategoryNode, root: { id: string; name: string }) => {
    top.set(node.id, root);
    for (const c of node.subRows ?? []) walk(c, root);
  };
  for (const root of tree) {
    if (root.parent_id) continue;
    const r = { id: root.id, name: root.name };
    order.push(r);
    walk(root, r);
  }
  const byId = new Map(tree.map((c) => [c.id, c]));
  for (const c of tree) {
    if (top.has(c.id)) continue;
    let cur: BillzCategoryNode | undefined = c;
    const seen = new Set<string>();
    while (cur?.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parent_id);
    }
    if (cur) top.set(c.id, { id: cur.id, name: cur.name });
  }
  return { top, order };
}

// ── Ommaviy funksiyalar ─────────────────────────────────────

/** Kategoriyalar ro'yxatini BILLZ'dan yuklaydi.
 *  Qaytaradi:
 *    topLevel — Mini App chiplari uchun (faqat yuqori darajali)
 *    allById  — har qanday kategoriya ID → nomi (pastki kategoriyalar uchun ham)
 */
export async function fetchCategories(): Promise<{ topLevel: Category[]; allById: Map<string, string> }> {
  const tree: BillzCategoryNode[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await billz<{ count?: number; categories?: BillzCategoryNode[] | null }>("/v2/category", {
      query: { limit: 200, page },
    });
    const items = r.categories ?? [];
    tree.push(...items);
    if (items.length < 200) break;
  }
  const { top, order } = buildTopLevelMap(tree);
  const orderIdx = new Map(order.map((c, i) => [c.id, i]));

  // Barcha kategoriyalar xaritasi: ID → nom (pastki kategoriyalar uchun ham).
  const allById = new Map<string, string>();
  const walkAll = (nodes: BillzCategoryNode[]) => {
    for (const n of nodes) {
      allById.set(n.id, n.name);
      if (n.subRows) walkAll(n.subRows);
    }
  };
  walkAll(tree);
  // Tekis ro'yxatdagi kategoriyalar ham.
  for (const c of tree) allById.set(c.id, c.name);

  // Faqat noyob yuqori darajali — Mini App chiplari uchun.
  const seen = new Map<string, string>();
  for (const [, root] of top) { seen.set(root.id, root.name); }
  const topLevel = [...seen.entries()]
    .map(([id, name]) => ({ id, name, order: orderIdx.get(id) ?? 999 }))
    .sort((a, b) => a.order - b.order);

  return { topLevel, allById };
}

/** Do'konlar ro'yxatini yuklaydi. */
export async function fetchShops(): Promise<BillzShop[]> {
  try {
    const r = await billz<{ shops?: BillzShop[] }>("/v1/shop", { query: { limit: 100 } });
    const all = (r.shops ?? []).map((s) => ({ id: s.id, name: s.name }));
    return config.billz.shopIds.length
      ? config.billz.shopIds.map((id) => all.find((s) => s.id === id) ?? { id, name: id })
      : all;
  } catch (e) {
    console.warn("[billz] do'konlar olinmadi:", (e as Error).message);
    return [];
  }
}

/** Set-current-shop (ba'zi BILLZ muhitlarida kerak). */
export async function ensureCurrentShop(): Promise<void> {
  const shopId = config.billz.shopIds[0];
  if (!shopId) return;
  try {
    await billz(`/v1/user/set-current-shop/${shopId}`, { method: "PATCH", asyncHttp: true });
  } catch (e) {
    console.warn("[billz] set-current-shop xato (davom etamiz):", (e as Error).message);
  }
}

/**
 * Mahsulotlarni BILLZ'dan sahifalab oladi — BITTA sahifa.
 * Mini App scroll qilganda keyingi sahifa so'raladi.
 */
export async function fetchProductsPage(opts: {
  page: number;
  limit?: number;
  categoryId?: string;
  search?: string;
}): Promise<{ products: BillzProductRaw[]; total: number }> {
  const limit = opts.limit ?? 20;
  // BILLZ `GET /v2/products` da category/search filtri yo'q — `POST /v2/product-search-with-filters` ishlatamiz.
  // Lekin u boshqa formatda javob beradi. Shuning uchun hozircha oddiy GET bilan sahifalab olamiz.
  const r = await billz<{ count?: number; products?: BillzProductRaw[] | null }>("/v2/products", {
    query: { limit, page: opts.page, search: opts.search || undefined },
    timeoutMs: 30_000,
  });
  return { products: r.products ?? [], total: Number(r.count ?? 0) };
}

/** Bitta mahsulotni BILLZ'dan oladi (ID bo'yicha). Aslida bu sahifalab topish — BILLZ'da bitta mahsulotni olish endpoint yo'q. */
export async function fetchProductById(productId: string): Promise<BillzProductRaw | null> {
  // BILLZ'da ID bo'yicha bitta mahsulot olish uchun maxsus endpoint yo'q.
  // search parametri bilan qidiramiz.
  try {
    const r = await billz<{ products?: BillzProductRaw[] | null }>("/v2/products", {
      query: { limit: 10, page: 1, search: productId },
      timeoutMs: 15_000,
    });
    return (r.products ?? []).find((p) => p.id === productId) ?? null;
  } catch {
    return null;
  }
}

/** Kategoriya daraxti → har bir BILLZ kategoriya ID uchun yuqori darajali kategoriya. */
export function getCategoryResolver(categories: Category[]) {
  // Sodda: hozircha kategoriyalar o'zi yuqori darajali.
  const map = new Map(categories.map((c) => [c.id, c]));
  return (refs: BillzCategoryRef[]): string[] => {
    const ids: string[] = [];
    for (const r of refs) {
      const c = map.get(r.id);
      if (c && !ids.includes(c.id)) ids.push(c.id);
      // Agar kategoriya topilmasa, parent_id orqali qidiramiz.
      if (!c) {
        // Categoriya nomi bilan solishtiramiz.
        for (const cat of categories) {
          if (String(cat.name).toLowerCase() === r.name.toLowerCase() && !ids.includes(cat.id)) {
            ids.push(cat.id);
            break;
          }
        }
      }
    }
    return ids;
  };
}
