import { config } from "../config.js";
import type { CatalogSnapshot, Category, Product, Variant } from "../catalog/types.js";
import { billz } from "./client.js";

/**
 * BILLZ katalogini to'liq yuklab, Mini App modeliga o'giradi.
 *
 *  • GET /v2/products (limit ≤ 300, sahifalab) — variatsiyalar tekis ro'yxatda keladi,
 *    `parent_id` orqali ota tovarga guruhlaymiz (bitta karta + o'lcham tanlagich).
 *  • GET /v2/category — kategoriya daraxti; tovar kategoriyasini yuqori darajadagi
 *    kategoriyaga ko'taramiz (Mini App'dagi chiplar uchun).
 *  • Narx va qoldiq — do'kon kesimida (`BILLZ_SHOP_IDS`).
 *  • Natija faqat BARCHA sahifalar muvaffaqiyatli yuklangandan keyin qo'llanadi.
 */

const SERVICE_TYPE_ID = "5a0e556a-15f8-47ac-ae07-46972f3c6ab4";
const PAGE_LIMIT = 300;
const MAX_PAGES = 200;

interface BillzCategoryRef {
  id: string;
  name: string;
  parent_id?: string;
}

interface BillzProduct {
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
  shop_prices?:
    | {
        shop_id: string;
        retail_price: number;
        retail_currency?: string;
        promo_price?: number;
        promos?: unknown[] | null;
      }[]
    | null;
  updated_at?: string;
}

interface BillzCategoryNode {
  id: string;
  name: string;
  parent_id?: string;
  subRows?: BillzCategoryNode[] | null;
  product_count?: number;
}

async function fetchAllProducts(): Promise<BillzProduct[]> {
  const all: BillzProduct[] = [];
  let total = Infinity;
  for (let page = 1; page <= MAX_PAGES && all.length < total; page++) {
    const r = await billz<{ count?: number; products?: BillzProduct[] | null }>("/v2/products", {
      query: { limit: PAGE_LIMIT, page },
    });
    const items = r.products ?? [];
    total = Number(r.count ?? 0);
    all.push(...items);
    if (items.length < PAGE_LIMIT) break;
  }
  if (Number.isFinite(total) && total > 0 && all.length < total) {
    throw new Error(`BILLZ katalogi to'liq yuklanmadi: ${all.length}/${total}`);
  }
  return all;
}

async function fetchCategoryTree(): Promise<BillzCategoryNode[]> {
  const out: BillzCategoryNode[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await billz<{ count?: number; categories?: BillzCategoryNode[] | null }>("/v2/category", {
      query: { limit: 200, page },
    });
    const items = r.categories ?? [];
    out.push(...items);
    if (items.length < 200) break;
  }
  return out;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

function shopAllowed(shopId: string) {
  return config.billz.shopIds.length === 0 || config.billz.shopIds.includes(shopId);
}

function priceOf(p: BillzProduct): { price: number; oldPrice: number | null } {
  const prices = (p.shop_prices ?? []).filter((x) => n(x.retail_price) > 0);
  // Avval sozlangan do'kon tartibida qidiramiz, topilmasa — birinchisi.
  let sp = undefined as (typeof prices)[number] | undefined;
  for (const id of config.billz.shopIds) {
    sp = prices.find((x) => x.shop_id === id);
    if (sp) break;
  }
  sp ??= prices[0];
  if (!sp) return { price: 0, oldPrice: null };
  const retail = Math.round(n(sp.retail_price));
  const promo = Math.round(n(sp.promo_price));
  // promo_price faqat promos to'ldirilgan bo'lsa haqiqiy.
  if (Array.isArray(sp.promos) && sp.promos.length > 0 && promo > 0 && promo < retail) {
    return { price: promo, oldPrice: retail };
  }
  return { price: retail, oldPrice: null };
}

function stockOf(p: BillzProduct): number {
  return (p.shop_measurement_values ?? [])
    .filter((s) => shopAllowed(s.shop_id))
    .reduce((sum, s) => sum + Math.max(0, n(s.active_measurement_value)), 0);
}

function photosOf(p: BillzProduct): string[] {
  const list = [...(p.photos ?? [])]
    .filter((x) => x && x.photo_url)
    .sort((a, b) => Number(Boolean(b.is_main)) - Number(Boolean(a.is_main)) || n(a.sequence) - n(b.sequence))
    .map((x) => x.photo_url);
  if (p.main_image_url && !list.includes(p.main_image_url)) list.unshift(p.main_image_url);
  return list;
}

function variantLabel(p: BillzProduct, baseName: string): string {
  const attrs = (p.product_attributes ?? []).map((a) => String(a.attribute_value ?? "").trim()).filter(Boolean);
  if (attrs.length) return attrs.join(" / ");
  // "Ota nomi / 38" ko'rinishidagi nomdan qolgan qismini olamiz.
  if (baseName && p.name.startsWith(baseName)) return p.name.slice(baseName.length).replace(/^[\s/|-]+/, "").trim();
  return "";
}

/** Har bir kategoriya ID → eng yuqori ota kategoriya. */
function buildTopLevelMap(tree: BillzCategoryNode[]) {
  const top = new Map<string, { id: string; name: string }>();
  const order: { id: string; name: string }[] = [];
  const walk = (node: BillzCategoryNode, root: { id: string; name: string }) => {
    top.set(node.id, root);
    for (const c of node.subRows ?? []) walk(c, root);
  };
  for (const root of tree) {
    // API ba'zan tekis ro'yxat ham qaytarishi mumkin — faqat ildizlardan boshlaymiz.
    if (root.parent_id) continue;
    const r = { id: root.id, name: root.name };
    order.push(r);
    walk(root, r);
  }
  // Tekis ro'yxat holati: parent_id bo'yicha ildizga ko'taramiz.
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

export async function syncFromBillz(): Promise<CatalogSnapshot> {
  const startedAt = new Date().toISOString();
  const raw = await fetchAllProducts();
  let tree: BillzCategoryNode[] = [];
  try {
    tree = await fetchCategoryTree();
  } catch (e) {
    console.warn("[billz] kategoriya daraxti olinmadi, tovar kategoriyalari ishlatiladi:", (e as Error).message);
  }
  const { top, order } = buildTopLevelMap(tree);
  const toTop = (c: BillzCategoryRef) => top.get(c.id) ?? { id: c.id, name: c.name };

  const items = raw.filter((p) => p && p.id && p.product_type_id !== SERVICE_TYPE_ID);
  const parents = new Map(items.filter((p) => p.is_variative && !p.parent_id).map((p) => [p.id, p]));

  // Guruhlash: kalit = ota ID (variatsiya) yoki o'z ID (oddiy tovar).
  const groups = new Map<string, BillzProduct[]>();
  for (const p of items) {
    if (p.is_variative && !p.parent_id) continue; // ota tovarning o'zi sotilmaydi
    const key = p.parent_id || p.id;
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }

  const usedCats = new Map<string, string>();
  const products: Product[] = [];

  for (const [key, children] of groups) {
    const parent = parents.get(key);
    const first = children[0]!;
    const baseName =
      parent?.name || first.base_name || (first.parent_id ? first.name.split(" / ")[0]!.trim() : first.name);

    const variants: Variant[] = children.map((c) => {
      const pr = priceOf(c);
      return {
        id: c.id,
        label: first.parent_id || parent ? variantLabel(c, baseName) : "",
        sku: c.sku ?? "",
        barcode: c.barcode ?? "",
        price: pr.price,
        oldPrice: pr.oldPrice,
        stock: stockOf(c),
      };
    });
    // Narxi yo'q (sotuvga chiqmagan) variantlarni yashiramiz.
    const sellable = variants.filter((v) => v.price > 0);
    if (!sellable.length) continue;
    sellable.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

    const catsSrc = (parent?.categories?.length ? parent.categories : first.categories) ?? [];
    const catIds: string[] = [];
    for (const c of catsSrc) {
      const t = toTop(c);
      if (!catIds.includes(t.id)) catIds.push(t.id);
      usedCats.set(t.id, t.name);
    }

    const images: string[] = [];
    for (const src of [parent, ...children]) {
      if (!src) continue;
      for (const u of photosOf(src)) if (!images.includes(u)) images.push(u);
    }

    const attributeNames = [
      ...new Set(
        children.flatMap((c) => (c.product_attributes ?? []).map((a) => String(a.attribute_name ?? "").trim())),
      ),
    ].filter(Boolean);

    const updatedAt = [parent, ...children]
      .map((x) => x?.updated_at ?? "")
      .filter(Boolean)
      .sort()
      .pop();

    products.push({
      id: key,
      name: baseName,
      description: (parent?.description || first.description || "").trim(),
      brand: parent?.brand_name || first.brand_name || "",
      sku: parent?.sku || first.sku || "",
      categoryIds: catIds,
      images: images.slice(0, 10),
      variants: sellable,
      attributeNames,
      featured: false,
      updatedAt: updatedAt ? new Date(updatedAt.replace(" ", "T") + "Z").toISOString() : startedAt,
    });
  }

  const orderIdx = new Map(order.map((c, i) => [c.id, i]));
  const categories: Category[] = [...usedCats.entries()]
    .map(([id, name]) => ({ id, name, order: orderIdx.get(id) ?? 999 }))
    .sort((a, b) => a.order - b.order || String(a.name).localeCompare(String(b.name)));

  return { source: "billz", syncedAt: startedAt, categories, products };
}
