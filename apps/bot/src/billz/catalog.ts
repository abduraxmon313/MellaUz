import { config } from "../config.js";
import type { Category, Product, ShopStock, Variant } from "../catalog/types.js";
import { billz } from "./client.js";

/**
 * BILLZ katalogi — yuklash va indeks qurish.
 *
 * BILLZ hujjati (docs.billz.io → "Синхронизация каталога") tavsiyasi bo'yicha:
 *  • To'liq yuklash: GET /v2/products sahifalab (limit=100; 300 da BILLZ 500 qaytargan).
 *  • Keyin faqat o'zgarganlar: GET /v2/products?last_updated_date=… (UTC).
 *  • Variatsiyalar tekis ro'yxatda keladi — ota tovar (parent_id) bo'yicha guruhlanadi.
 *    Bu faqat BUTUN ro'yxat bo'yicha to'g'ri ishlaydi: bitta sahifa ichida guruhlansa,
 *    o'lchamlar boshqa sahifalarga tushib, bitta mahsulot qayta-qayta chiqadi.
 *
 * Ma'lumot DB'ga yozilmaydi — faqat server xotirasida (indeks) turadi.
 */

const SERVICE_TYPE_ID = "5a0e556a-15f8-47ac-ae07-46972f3c6ab4";
/** BILLZ limit=300 da 500 qaytargan; 100 barqaror ishlaydi. Testda kichraytirish mumkin. */
const PAGE_LIMIT = Math.min(300, Math.max(1, Number(process.env.BILLZ_PAGE_LIMIT) || 100));
const PAGE_RETRIES = 3;

// ── Tiplar ──────────────────────────────────────────────────

interface BillzCategoryRef {
  id: string;
  name: string;
  parent_id?: string;
}

interface BillzCategoryNode {
  id: string;
  name: string;
  parent_id?: string;
  subRows?: BillzCategoryNode[] | null;
}

export interface BillzShop {
  id: string;
  name: string;
}

interface BillzProductRaw {
  id: string;
  name?: string;
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
  shop_prices?:
    | { shop_id: string; retail_price: number; promo_price?: number; promos?: unknown[] | null }[]
    | null;
  updated_at?: string;
}

/** Xotirada saqlanadigan ixcham ko'rinish (keraksiz maydonlarsiz — 23k+ tovar uchun). */
export interface SlimProduct {
  id: string;
  name: string;
  baseName: string;
  sku: string;
  barcode: string;
  brand: string;
  description: string;
  isVariative: boolean;
  parentId: string;
  images: string[];
  categoryIds: string[];
  categoryNames: string[];
  attrs: { name: string; value: string }[];
  isService: boolean;
  /** shopId → [narx, aksiya narxi (0 — yo'q)] */
  prices: Record<string, [number, number]>;
  /** shopId → faol qoldiq */
  stocks: Record<string, number>;
  updatedAt: string;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

function slim(p: BillzProductRaw): SlimProduct {
  const photos = [...(p.photos ?? [])]
    .filter((x) => x && x.photo_url)
    .sort((a, b) => Number(Boolean(b.is_main)) - Number(Boolean(a.is_main)) || n(a.sequence) - n(b.sequence))
    .map((x) => x.photo_url);
  if (p.main_image_url && !photos.includes(p.main_image_url)) photos.unshift(p.main_image_url);

  const prices: Record<string, [number, number]> = {};
  for (const sp of p.shop_prices ?? []) {
    const retail = Math.round(n(sp.retail_price));
    if (retail <= 0) continue;
    const promo = Math.round(n(sp.promo_price));
    // promo_price faqat promos to'ldirilgan bo'lsa haqiqiy (BILLZ hujjati).
    const hasPromo = Array.isArray(sp.promos) && sp.promos.length > 0 && promo > 0 && promo < retail;
    prices[sp.shop_id] = [retail, hasPromo ? promo : 0];
  }
  const stocks: Record<string, number> = {};
  for (const s of p.shop_measurement_values ?? []) stocks[s.shop_id] = Math.max(0, n(s.active_measurement_value));

  return {
    id: p.id,
    name: String(p.name ?? "").trim(),
    baseName: String(p.base_name ?? "").trim(),
    sku: String(p.sku ?? ""),
    barcode: String(p.barcode ?? ""),
    brand: String(p.brand_name ?? ""),
    description: String(p.description ?? "").trim(),
    isVariative: Boolean(p.is_variative),
    parentId: String(p.parent_id ?? ""),
    images: photos.slice(0, 10),
    categoryIds: (p.categories ?? []).map((c) => c.id),
    categoryNames: (p.categories ?? []).map((c) => c.name),
    attrs: (p.product_attributes ?? [])
      .map((a) => ({ name: String(a.attribute_name ?? "").trim(), value: String(a.attribute_value ?? "").trim() }))
      .filter((a) => a.value),
    isService: p.product_type_id === SERVICE_TYPE_ID,
    prices,
    stocks,
    updatedAt: String(p.updated_at ?? ""),
  };
}

// ── So'rovlar ───────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page: number, lastUpdated?: string) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < PAGE_RETRIES; attempt++) {
    try {
      const r = await billz<{ count?: number; products?: BillzProductRaw[] | null }>("/v2/products", {
        query: { limit: PAGE_LIMIT, page, last_updated_date: lastUpdated },
        timeoutMs: 60_000,
      });
      return { items: (r.products ?? []).filter((p) => p && p.id), count: Number(r.count ?? 0) };
    } catch (e) {
      // BILLZ ba'zan vaqtincha 500 qaytaradi — shu sahifani qayta so'raymiz.
      lastErr = e;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}

/**
 * Barcha mahsulotlarni sahifalab yuklaydi. `onProgress` har 20 sahifada chaqiriladi —
 * birinchi ishga tushishda Mini App to'liq yuklanishni kutmasdan mahsulot ko'rsata oladi.
 * Natija faqat barcha sahifalar muvaffaqiyatli yuklansa qaytadi.
 */
export async function fetchAllProducts(
  onProgress?: (items: SlimProduct[], loaded: number, total: number) => void,
): Promise<SlimProduct[]> {
  const all: SlimProduct[] = [];
  let total = 0;
  for (let page = 1; page <= 3000; page++) {
    const r = await fetchPage(page);
    total = r.count || total;
    for (const p of r.items) all.push(slim(p));
    if (onProgress && page % 20 === 0) onProgress(all, all.length, total);
    if (r.items.length < PAGE_LIMIT || (total > 0 && all.length >= total)) break;
  }
  if (total > 0 && all.length < total) {
    throw new Error(`BILLZ katalogi to'liq yuklanmadi: ${all.length}/${total}`);
  }
  return all;
}

/** `since` dan keyin o'zgargan mahsulotlar (UTC). BILLZ formati: "2026-10-29 12:00:00". */
export async function fetchUpdatedSince(since: Date): Promise<SlimProduct[]> {
  const stamp = since.toISOString().replace("T", " ").slice(0, 19);
  const out: SlimProduct[] = [];
  for (let page = 1; page <= 500; page++) {
    const r = await fetchPage(page, stamp);
    for (const p of r.items) out.push(slim(p));
    if (r.items.length < PAGE_LIMIT) break;
  }
  return out;
}

export async function fetchCategoryTree(): Promise<BillzCategoryNode[]> {
  const out: BillzCategoryNode[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await billz<{ categories?: BillzCategoryNode[] | null }>("/v2/category", {
      query: { limit: 200, page },
    });
    const items = r.categories ?? [];
    out.push(...items);
    if (items.length < 200) break;
  }
  return out;
}

export async function fetchShops(): Promise<BillzShop[]> {
  const r = await billz<{ shops?: BillzShop[] }>("/v1/shop", { query: { limit: 100 } });
  const all = (r.shops ?? []).map((s) => ({ id: s.id, name: s.name }));
  if (!config.billz.shopIds.length) return all;
  return config.billz.shopIds.map((id) => all.find((s) => s.id === id) ?? { id, name: id });
}

// ── Indeks qurish ───────────────────────────────────────────

/** Har bir kategoriya ID → eng yuqori ota kategoriya (Mini App chiplari uchun). */
function topLevelMap(tree: BillzCategoryNode[]) {
  const top = new Map<string, { id: string; name: string }>();
  const order = new Map<string, number>();
  const walk = (node: BillzCategoryNode, root: { id: string; name: string }) => {
    top.set(node.id, root);
    for (const c of node.subRows ?? []) walk(c, root);
  };
  for (const root of tree) {
    if (root.parent_id) continue;
    const r = { id: root.id, name: root.name };
    order.set(r.id, order.size);
    walk(root, r);
  }
  // Tekis ro'yxat holati: parent_id zanjiri bo'yicha ildizgacha ko'tariladi.
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

const norm = (s: string) => s.toLowerCase().replace(/[\s'`‘’"]+/g, " ").trim();

function allowedShop(id: string) {
  return config.billz.shopIds.length === 0 || config.billz.shopIds.includes(id);
}

function shopStocksOf(p: SlimProduct, shopIds: string[]): ShopStock[] {
  return shopIds
    .map((shopId) => {
      const pr = p.prices[shopId];
      return {
        shopId,
        price: pr ? (pr[1] || pr[0]) : 0,
        oldPrice: pr && pr[1] ? pr[0] : null,
        stock: p.stocks[shopId] ?? 0,
      };
    })
    .filter((s) => s.price > 0 || s.stock > 0);
}

/** Sukut narx: sozlangan filiallar tartibida birinchi narx, aks holda istalgan. */
function defaultPrice(p: SlimProduct): { price: number; oldPrice: number | null } {
  const ids = config.billz.shopIds.length ? config.billz.shopIds : Object.keys(p.prices);
  for (const id of ids) {
    const pr = p.prices[id];
    if (pr) return { price: pr[1] || pr[0], oldPrice: pr[1] ? pr[0] : null };
  }
  const any = Object.values(p.prices)[0];
  return any ? { price: any[1] || any[0], oldPrice: any[1] ? any[0] : null } : { price: 0, oldPrice: null };
}

function totalAllowedStock(p: SlimProduct) {
  return Object.entries(p.stocks).reduce((s, [id, v]) => (allowedShop(id) ? s + v : s), 0);
}

function labelOf(c: SlimProduct, baseName: string): string {
  if (c.attrs.length) return c.attrs.map((a) => a.value).join(" / ");
  if (baseName && c.name.length > baseName.length && c.name.startsWith(baseName)) {
    const rest = c.name.slice(baseName.length).replace(/^[\s/|,-]+/, "").trim();
    if (rest) return rest;
  }
  return "";
}

export interface BillzIndex {
  products: Product[];
  categories: Category[];
}

export function buildIndex(items: SlimProduct[], tree: BillzCategoryNode[], shops: BillzShop[]): BillzIndex {
  const { top, order } = topLevelMap(tree);
  const shopIds = shops.length ? shops.map((s) => s.id) : config.billz.shopIds;
  const byId = new Map(items.map((p) => [p.id, p]));

  // 1) parent_id bo'yicha guruhlash (butun ro'yxat bo'yicha).
  const groups = new Map<string, SlimProduct[]>();
  for (const p of items) {
    if (p.isService) continue;
    if (p.isVariative && !p.parentId) continue; // ota tovarning o'zi sotilmaydi
    const key = p.parentId || p.id;
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }

  // 2) Variatsiyasiz, lekin nomi va kategoriyasi bir xil tovarlar — bitta karta
  //    (ba'zi do'konlar har o'lchamni alohida tovar qilib kiritadi).
  const byName = new Map<string, string>();
  for (const [key, members] of [...groups]) {
    const first = members[0]!;
    if (first.parentId || members.length > 1) continue;
    const nameKey = `${norm(first.name)}|${first.categoryIds[0] ?? ""}`;
    if (!first.name) continue;
    const target = byName.get(nameKey);
    if (target && target !== key) {
      groups.get(target)!.push(...members);
      groups.delete(key);
    } else {
      byName.set(nameKey, key);
    }
  }

  const products: Product[] = [];
  const catCounts = new Map<string, { name: string; count: number }>();

  for (const [key, members] of groups) {
    const parent = byId.get(key);
    const first = members[0]!;
    const baseName =
      (parent && parent.id !== first.id ? parent.name : "") ||
      first.baseName ||
      (first.parentId ? first.name.split(" / ")[0]!.trim() : first.name);

    const multi = members.length > 1 || Boolean(first.parentId);
    const variants: Variant[] = members
      .map((c, i) => {
        const pr = defaultPrice(c);
        let label = multi ? labelOf(c, baseName) : "";
        if (multi && !label) label = c.sku || c.barcode || `#${i + 1}`;
        return {
          id: c.id,
          label,
          sku: c.sku,
          barcode: c.barcode,
          price: pr.price,
          oldPrice: pr.oldPrice,
          stock: totalAllowedStock(c),
          shopStocks: shopStocksOf(c, shopIds),
        };
      })
      .filter((v) => v.price > 0);
    if (!variants.length) continue;
    variants.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

    const src = parent ?? first;
    const catRefs = (src.categoryIds.length ? src : first).categoryIds.map((id, i) => ({
      id,
      name: (src.categoryIds.length ? src : first).categoryNames[i] ?? "",
    }));
    const catIds: string[] = [];
    for (const c of catRefs) {
      const t = top.get(c.id) ?? { id: c.id, name: c.name };
      if (!t.name || catIds.includes(t.id)) continue;
      catIds.push(t.id);
      const cc = catCounts.get(t.id);
      if (cc) cc.count++;
      else catCounts.set(t.id, { name: t.name, count: 1 });
    }

    const images: string[] = [];
    for (const s of [parent, ...members]) {
      if (!s) continue;
      for (const u of s.images) if (!images.includes(u)) images.push(u);
    }

    const attributeNames = [...new Set(members.flatMap((c) => c.attrs.map((a) => a.name)))].filter(Boolean);
    const updatedAt = [parent, ...members]
      .map((x) => x?.updatedAt ?? "")
      .filter(Boolean)
      .sort()
      .pop();

    products.push({
      id: key,
      name: baseName,
      description: (parent?.description || first.description || "").trim(),
      brand: parent?.brand || first.brand || "",
      sku: parent?.sku || first.sku || "",
      categoryIds: catIds,
      images: images.slice(0, 10),
      variants,
      attributeNames,
      featured: false,
      updatedAt: updatedAt ? new Date(updatedAt.replace(" ", "T") + "Z").toISOString() : new Date(0).toISOString(),
    });
  }

  // Faqat mahsuloti bor kategoriyalar (BILLZ'dagi bo'sh/eskirgan kategoriyalar ko'rsatilmaydi).
  const categories: Category[] = [...catCounts.entries()]
    .map(([id, c]) => ({ id, name: c.name, order: order.get(id) ?? 999 }))
    .sort((a, b) => (catCounts.get(b.id)!.count - catCounts.get(a.id)!.count) || a.order - b.order);

  return { products, categories };
}
