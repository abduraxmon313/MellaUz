import { createHash } from "node:crypto";
import { config, hasBillz } from "../config.js";
import { store } from "../store.js";
import {
  ensureCurrentShop,
  fetchCategories,
  fetchProductsPage,
  fetchShops,
  photosOf,
  priceOf,
  stockOf,
  variantLabel,
  type BillzProductRaw,
  type BillzShop,
} from "../billz/catalog.js";
import { buildMockSnapshot } from "./mock.js";
import { categories as mockCategories } from "./mock-source.js";
import type { ManualRow } from "../store.js";
import type { CatalogSnapshot, Category, Lang, Localized, Product, Variant } from "./types.js";

/**
 * Katalog xizmati:
 * • Kategoriyalar va do'konlar — xotirada (bir marta yuklanadi).
 * • Mahsulotlar — BILLZ'dan sahifalab, serverda guruhlab qaytariladi.
 * • Variatsiyalar ota tovarga birlashtiriladi (bitta karta + o'lcham tanlagich).
 */

const SERVICE_TYPE_ID = "5a0e556a-15f8-47ac-ae07-46972f3c6ab4";
const KV_CATEGORIES = "billz_categories";
const KV_SHOPS = "billz_shops";

let categories: Category[] = [];
/** Barcha BILLZ kategoriya ID → nomi (pastki ham). */
let allCatNames = new Map<string, string>();
/** Barcha BILLZ kategoriya ID → nomi (pastki kategoriyalar uchun ham). */
let shops: BillzShop[] = [];
let manual: { products: Product[]; hideSamples: boolean } = { products: [], hideSamples: false };
let manualError = "";
let lastError = "";
let mockSnapshot: CatalogSnapshot | null = null;

const imageMap = new Map<string, string>();

export function imageKey(url: string) {
  return createHash("sha1").update(url).digest("hex").slice(0, 32);
}
export function resolveImageKey(key: string) { return imageMap.get(key) ?? null; }

export function publicImage(url: string | undefined) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) {
    const k = imageKey(url);
    imageMap.set(k, url);
    return `/img/${k}`;
  }
  return url;
}

export function loc(v: Localized, lang: Lang): string {
  if (typeof v === "string") return v;
  return v[lang] || v.uz || v.ru || v.en || "";
}

export function catalogStatus() {
  return {
    source: hasBillz ? "billz" : "mock",
    syncedAt: new Date().toISOString(),
    products: hasBillz ? "BILLZ (sahifalab)" : (mockSnapshot?.products.length ?? 0),
    categories: categories.length,
    shops: shops.length,
    manualProducts: manual.products.length,
    lastError,
    manualError,
  };
}

export function listShops() { return shops; }

// ── Qo'lda kiritilgan mahsulotlar ──────────────────────────

export function isManualId(id: string) { return id.startsWith("m-"); }

function manualToProduct(m: ManualRow): Product {
  const description: Record<string, string> = {};
  for (const l of ["uz", "ru", "en"] as const) {
    const d = m.description[l] || m.description.uz || "";
    const mat = m.material?.[l] || m.material?.uz || "";
    description[l] = mat ? `${d}\n\n${mat}` : d;
  }
  const variants: Variant[] = m.sizes.length
    ? m.sizes.map((s) => ({
        id: `${m.id}~${s.label}`, label: s.label, sku: `${m.sku}-${s.label}`, barcode: "",
        price: m.price, oldPrice: m.oldPrice, stock: Math.max(0, s.stock), shopStocks: [],
      }))
    : [{ id: m.id, label: "", sku: m.sku, barcode: "", price: m.price, oldPrice: m.oldPrice, stock: Math.max(0, m.stock), shopStocks: [] }];
  return {
    id: m.id, name: m.name, description, brand: "MELLA", sku: m.sku,
    categoryIds: [m.category], images: m.imageIds.map((id) => `/media/${id}`),
    variants, attributeNames: m.sizes.length ? ["O'lcham"] : [],
    featured: m.featured, updatedAt: m.updatedAt,
  };
}

export async function refreshManual(): Promise<void> {
  try {
    const res = await store.listManualProducts();
    manual = { products: res.products.map(manualToProduct), hideSamples: res.hideSamples };
    manualError = "";
  } catch (e) {
    manualError = (e as Error).message;
  }
}

// ── Boshlash ────────────────────────────────────────────────

let manualTimer: NodeJS.Timeout | null = null;
let catTimer: NodeJS.Timeout | null = null;

export async function initCatalog() {
  await refreshManual();
  manualTimer = setInterval(() => void refreshManual(), 30_000);
  manualTimer.unref();

  if (!hasBillz) {
    mockSnapshot = buildMockSnapshot();
    categories = mockSnapshot.categories;
    console.log("[catalog] BILLZ yo'q — namuna katalog.");
    return;
  }

  try {
    const saved = await store.kvGet<Category[]>(KV_CATEGORIES);
    if (saved?.length) { categories = saved; }
  } catch {}
  try {
    const saved = await store.kvGet<BillzShop[]>(KV_SHOPS);
    if (saved?.length) shops = saved;
  } catch {}

  void syncMeta();
  catTimer = setInterval(() => void syncMeta(), config.billz.syncMinutes * 60_000);
  catTimer.unref();
}

export async function syncMeta(): Promise<void> {
  try {
    await ensureCurrentShop();
    const [catResult, sh] = await Promise.all([fetchCategories(), fetchShops()]);
    categories = catResult.topLevel;
    allCatNames = catResult.allById;
    shops = sh;
    lastError = "";
    await store.kvSet(KV_CATEGORIES, catResult.topLevel).catch(() => {});
    await store.kvSet(KV_SHOPS, sh).catch(() => {});
    console.log(`[catalog] BILLZ meta: ${categories.length} kategoriya (${allCatNames.size} jami), ${sh.length} do'kon`);
  } catch (e) {
    lastError = (e as Error).message;
    console.error("[catalog] BILLZ meta xatosi:", lastError);
  }
}

export async function syncNow(): Promise<void> { await syncMeta(); }

// ── Kategoriya nomi ─────────────────────────────────────────

function catName(catId: string, lang: Lang): string {
  if (!catId) return "";
  const c = categories.find((x) => x.id === catId);
  if (c) return loc(c.name, lang);
  const name = allCatNames.get(catId);
  if (name) return name;
  return "";
}

function productCatName(p: BillzProductRaw, _lang: Lang): string {
  const cats = p.categories;
  if (!cats?.length) return "";
  // 1) allCatNames xaritasidan (BILLZ daraxti — eng to'g'ri nom)
  for (const c of cats) {
    const name = allCatNames.get(c.id);
    if (name) return name;
  }
  // 2) BILLZ mahsulot ichida kelgan nom (fallback)
  return cats[0]?.name ?? "";
}

// ── BILLZ sahifasini guruhlash ──────────────────────────────
/**
 * BILLZ `GET /v2/products` variatsiyalarni tekis ro'yxatda qaytaradi.
 * Biz ota tovar + variatsiyalarni birlashtiramiz:
 *  - parent_id bor → variatsiya (kartaga kirmaydi, ota tovar ichiga kiradi)
 *  - is_variative && !parent_id → ota tovar skeleti (o'zi sotilmaydi)
 *  - oddiy tovar → bitta variant bilan karta
 */
interface GroupedProduct {
  parent: BillzProductRaw;
  children: BillzProductRaw[];
}

function groupBillzPage(items: BillzProductRaw[]): GroupedProduct[] {
  const byId = new Map(items.map((p) => [p.id, p]));
  const parentMap = new Map<string, BillzProductRaw[]>();

  for (const p of items) {
    if (p.product_type_id === SERVICE_TYPE_ID) continue;
    if (p.is_variative && !p.parent_id) {
      // Ota tovar — guruhlash uchun saqlaymiz.
      if (!parentMap.has(p.id)) parentMap.set(p.id, []);
      continue;
    }
    if (p.parent_id) {
      // Variatsiya — ota tovar ostiga yig'amiz.
      const group = parentMap.get(p.parent_id);
      if (group) group.push(p);
      else parentMap.set(p.parent_id, [p]);
      continue;
    }
    // Oddiy tovar (variatsiyasiz).
    parentMap.set(p.id, [p]);
  }

  const result: GroupedProduct[] = [];
  for (const [key, children] of parentMap) {
    const parent = byId.get(key);
    if (!parent) {
      // Ota tovar shu sahifada yo'q — variatsiyalarning o'zini ko'rsatamiz.
      if (children.length) result.push({ parent: children[0]!, children });
      continue;
    }
    if (parent.is_variative && !parent.parent_id) {
      // Ota tovar — variatsiyalar bilan birgalikda.
      if (children.length === 0) continue; // variatsiyalarsiz ota tovar ko'rsatilmaydi
      result.push({ parent, children });
    } else {
      // Oddiy tovar.
      result.push({ parent, children: [parent] });
    }
  }
  return result;
}

function groupedToCard(g: GroupedProduct, lang: Lang, shopId?: string) {
  const { parent, children } = g;
  const baseName = parent.base_name || parent.name?.split(" / ")[0]?.trim() || parent.name || "";
  const isVariative = children.length > 1 || (children[0] && children[0].id !== parent.id);

  // Rasmlar: ota tovardan + variatsiyalardan.
  const images: string[] = [];
  for (const src of [parent, ...children]) {
    for (const u of photosOf(src)) { if (!images.includes(u)) images.push(u); }
  }

  // Narx: eng arzon variant (qoldig'i bor) tanlangan do'kondan.
  let bestPrice = 0, bestOld: number | null = null, totalStk = 0;
  for (const c of children) {
    const pr = priceOf(c, shopId);
    const stk = stockOf(c, shopId);
    totalStk += stk;
    if (pr.price > 0 && (bestPrice === 0 || pr.price < bestPrice || (stk > 0 && bestPrice === 0))) {
      bestPrice = pr.price;
      bestOld = pr.oldPrice;
    }
  }

  const category = productCatName(parent, lang);

  return {
    id: parent.id,
    name: baseName,
    category,
    price: bestPrice,
    old_price: bestOld,
    price_from: new Set(children.map((c) => priceOf(c, shopId).price).filter(Boolean)).size > 1,
    image: publicImage(images[0]),
    in_stock: totalStk > 0,
    has_variants: isVariative,
    single_variant_id: isVariative ? null : (children[0]?.id ?? parent.id),
    stock: totalStk,
  };
}

// ── Ommaviy so'rov funksiyalari ─────────────────────────────

export function listCategories(lang: Lang) {
  return categories.map((c) => ({ id: c.id, name: loc(c.name, lang) }));
}

export async function listProducts(
  opts: { page?: number; limit?: number; category?: string; q?: string; shopId?: string; ids?: string[] },
  lang: Lang,
) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;

  // Qo'lda kiritilganlar (faqat birinchi sahifada).
  const manualCards = page === 1 && !opts.ids?.length
    ? manual.products
        .filter((p) => !opts.category || p.categoryIds.includes(opts.category))
        .filter((p) => {
          if (!opts.q) return true;
          const q = opts.q.toLowerCase();
          return loc(p.name, lang).toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
        })
        .map((p) => {
          const v = p.variants[0]!;
          const stock = p.variants.reduce((s, x) => s + x.stock, 0);
          return {
            id: p.id, name: loc(p.name, lang),
            category: catName(p.categoryIds[0] ?? "", lang),
            price: v.price, old_price: v.oldPrice, price_from: false,
            image: publicImage(p.images[0]), in_stock: stock > 0,
            has_variants: p.variants.length > 1 || Boolean(p.variants[0]?.label),
            single_variant_id: p.variants.length === 1 ? v.id : null, stock,
          };
        })
    : [];

  if (!hasBillz) {
    const mock = mockSnapshot;
    if (!mock) return { products: manualCards, total: manualCards.length, page, has_more: false };
    const hideBase = manual.hideSamples;
    let list = hideBase ? [] : mock.products;
    if (opts.category) list = list.filter((p) => p.categoryIds.includes(opts.category!));
    if (opts.q) {
      const q = opts.q.toLowerCase();
      list = list.filter((p) => loc(p.name, lang).toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    const start = (page - 1) * limit;
    const slice = list.slice(start, start + limit).map((p) => {
      const v = p.variants[0]!;
      const stock = p.variants.reduce((s, x) => s + x.stock, 0);
      return {
        id: p.id, name: loc(p.name, lang),
        category: catName(p.categoryIds[0] ?? "", lang),
        price: v.price, old_price: v.oldPrice, price_from: false,
        image: publicImage(p.images[0]), in_stock: stock > 0,
        has_variants: p.variants.length > 1, single_variant_id: p.variants.length === 1 ? v.id : null, stock,
      };
    });
    return { products: [...manualCards, ...slice], total: list.length + manualCards.length, page, has_more: start + limit < list.length };
  }

  // ── BILLZ: sahifalab olish + guruhlash ──
  try {
    // Ko'proq olamiz — guruhlash natijasida kamayadi.
    const r = await fetchProductsPage({ page, limit: limit * 3, search: opts.q });
    const grouped = groupBillzPage(r.products);

    let cards = grouped
      .map((g) => groupedToCard(g, lang, opts.shopId))
      .filter((c) => c.price > 0); // narxsizlarni yashiramiz

    // Kategoriya filtri.
    if (opts.category) {
      cards = cards.filter((c) => {
        // Card'dagi category nomi bilan solishtirish.
        if (!c.category) return false;
        const catObj = categories.find((x) => x.id === opts.category);
        return catObj ? c.category === loc(catObj.name, lang) : false;
      });
    }

    // Do'konda qoldig'i yo'qlarni pastga.
    cards.sort((a, b) => Number(b.in_stock) - Number(a.in_stock));

    const sliced = cards.slice(0, limit);

    return {
      products: [...manualCards, ...sliced],
      total: r.total,
      page,
      has_more: page * limit < r.total,
    };
  } catch (e) {
    console.error("[catalog] BILLZ products xato:", (e as Error).message);
    return { products: manualCards, total: manualCards.length, page, has_more: false, error: (e as Error).message };
  }
}

export async function getProductDetail(id: string, lang: Lang, shopId?: string) {
  // Qo'lda kiritilgan mahsulot.
  const mp = manual.products.find((p) => p.id === id);
  if (mp) {
    return {
      id: mp.id, name: loc(mp.name, lang),
      category: catName(mp.categoryIds[0] ?? "", lang),
      price: mp.variants[0]?.price ?? 0, old_price: mp.variants[0]?.oldPrice ?? null,
      price_from: false, image: publicImage(mp.images[0]),
      images: mp.images.map(publicImage),
      in_stock: mp.variants.some((v) => v.stock > 0),
      has_variants: mp.variants.length > 1 || Boolean(mp.variants[0]?.label),
      single_variant_id: mp.variants.length === 1 ? mp.variants[0]!.id : null,
      stock: mp.variants.reduce((s, v) => s + v.stock, 0),
      description: loc(mp.description, lang), brand: mp.brand, sku: mp.sku,
      attribute_name: mp.attributeNames.join(" / "),
      variants: mp.variants.map((v) => ({
        id: v.id, label: v.label, price: v.price, old_price: v.oldPrice,
        stock: v.stock, in_stock: v.stock > 0,
      })),
    };
  }

  if (!hasBillz) {
    const p = mockSnapshot?.products.find((x) => x.id === id);
    if (!p) return null;
    const v = p.variants[0]!;
    return {
      id: p.id, name: loc(p.name, lang),
      category: catName(p.categoryIds[0] ?? "", lang),
      price: v.price, old_price: v.oldPrice, price_from: false,
      image: publicImage(p.images[0]), images: p.images.map(publicImage),
      in_stock: v.stock > 0, has_variants: p.variants.length > 1,
      single_variant_id: p.variants.length === 1 ? v.id : null,
      stock: p.variants.reduce((s, x) => s + x.stock, 0),
      description: loc(p.description, lang), brand: p.brand, sku: p.sku,
      attribute_name: p.attributeNames.join(" / "),
      variants: p.variants.map((x) => ({
        id: x.id, label: x.label, price: x.price, old_price: x.oldPrice,
        stock: x.stock, in_stock: x.stock > 0,
      })),
    };
  }

  // ── BILLZ: mahsulot va uning variatsiyalarini topish ──
  try {
    // Kattaroq sahifa olib ichidan qidiramiz (ota tovar va variatsiyalar birga kelishi uchun).
    const r = await fetchProductsPage({ page: 1, limit: 100, search: id });
    const all = r.products ?? [];

    // ID bo'yicha aniq topamiz.
    let target = all.find((p) => p.id === id);
    if (!target) {
      // Agar topilmasa — barcode/sku bo'yicha.
      target = all.find((p) => p.sku === id || p.barcode === id);
    }
    if (!target) return null;

    // Agar bu variatsiya bo'lsa — ota tovarni topamiz.
    let parent = target;
    if (target.parent_id) {
      const p = all.find((x) => x.id === target!.parent_id);
      if (p) parent = p;
    }

    // Barcha variatsiyalarni yig'amiz.
    const children = parent.is_variative && !parent.parent_id
      ? all.filter((x) => x.parent_id === parent.id)
      : [parent];

    const baseName = parent.base_name || parent.name?.split(" / ")[0]?.trim() || parent.name || "";
    const images: string[] = [];
    for (const src of [parent, ...children]) {
      for (const u of photosOf(src)) { if (!images.includes(u)) images.push(u); }
    }

    const isVariative = children.length > 1 || (children.some((c) => c.parent_id));
    const variants = children.map((c) => {
      const pr = priceOf(c, shopId);
      const st = stockOf(c, shopId);
      return {
        id: c.id,
        label: isVariative ? variantLabel(c, baseName) : "",
        price: pr.price, old_price: pr.oldPrice,
        stock: st, in_stock: st > 0,
      };
    }).filter((v) => v.price > 0).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

    const first = variants[0];
    const totalStk = variants.reduce((s, v) => s + v.stock, 0);
    const category = productCatName(parent, lang);

    return {
      id: parent.id,
      name: baseName,
      category,
      price: first?.price ?? 0,
      old_price: first?.old_price ?? null,
      price_from: new Set(variants.map((v) => v.price).filter(Boolean)).size > 1,
      image: publicImage(images[0]),
      images: images.map(publicImage),
      in_stock: totalStk > 0,
      has_variants: variants.length > 1 || Boolean(variants[0]?.label),
      single_variant_id: variants.length === 1 ? variants[0]!.id : null,
      stock: totalStk,
      description: parent.description ?? "",
      brand: parent.brand_name ?? "",
      sku: parent.sku ?? "",
      attribute_name: [...new Set(children.flatMap((c) =>
        (c.product_attributes ?? []).map((a) => String(a.attribute_name ?? "").trim())
      ))].filter(Boolean).join(" / "),
      variants,
    };
  } catch (e) {
    console.error("[catalog] BILLZ detail xato:", (e as Error).message);
    return null;
  }
}

export function findVariant(variantId: string): { product: Product; variant: Variant } | null {
  for (const p of manual.products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { product: p, variant: v };
  }
  if (mockSnapshot) {
    for (const p of mockSnapshot.products) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) return { product: p, variant: v };
    }
  }
  return null;
}

export function totalStock(p: Product) {
  return p.variants.reduce((s, v) => s + v.stock, 0);
}
