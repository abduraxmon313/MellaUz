import "server-only";

import { randomBytes } from "node:crypto";
import { mirrorDb, primaryDb, type Sql } from "./db";
import type { Localized } from "./catalog/types";

/**
 * Qo'lda kiritiladigan katalog (vaqtinchalik — ERP ulanguncha).
 *
 * Ma'lumot ikki bazaga yoziladi:
 *   1) sayt bazasi (DATABASE_URL)       — sayt shu yerdan o'qiydi;
 *   2) bot bazasi  (BOT_DATABASE_URL)   — Mini App shu yerdan o'qiydi.
 * Ikkala bazadagi jadval tuzilmasi bir xil (apps/bot/src/store.ts dagi bilan ham).
 * Rasmlar BYTEA sifatida bazada saqlanadi.
 */

export interface SizeRow {
  label: string;
  stock: number;
}

export interface ManualProduct {
  id: string;
  slug: string;
  sku: string;
  category: string;
  name: Localized;
  description: Localized;
  material: Localized | null;
  price: number;
  oldPrice: number | null;
  /** O'lchamlar bo'lsa — qoldiq har o'lcham bo'yicha; bo'lmasa `stock`. */
  sizes: SizeRow[];
  stock: number;
  featured: boolean;
  published: boolean;
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ManualInput {
  sku?: string;
  category: string;
  name: Localized;
  description: Localized;
  material: Localized | null;
  price: number;
  oldPrice: number | null;
  sizes: SizeRow[];
  stock: number;
  featured: boolean;
  published: boolean;
}

export interface NewImage {
  contentType: string;
  data: Buffer;
}

/** Rasm tartibi: mavjud rasm ID'si yoki yangi yuklangan faylning indeksi. */
export type ImageSlot = { existing: string } | { upload: number };

export interface Settings {
  /** true — namuna (demo) mahsulotlar sayt va Mini App'da ko'rsatilmaydi. */
  hideSamples: boolean;
}

// ── Sxema ───────────────────────────────────────────────────────
// Bir vaqtda kelgan so'rovlar (va bot servisi ham shu bazada) jadvalni parallel yaratmasin:
// har ulanish uchun bitta va'da + PostgreSQL advisory lock (sayt va bot bilan bir xil kalit).
export const SCHEMA_LOCK = 774_210_001;
const ready = new WeakMap<Sql, Promise<void>>();

export function ensureSchema(sql: Sql): Promise<void> {
  let p = ready.get(sql);
  if (!p) {
    p = createSchema(sql).catch((err) => {
      ready.delete(sql);
      throw err;
    });
    ready.set(sql, p);
  }
  return p;
}

async function createSchema(sql: Sql) {
  await sql.begin(async (tx) => {
    const t = tx as unknown as Sql;
    await t`SELECT pg_advisory_xact_lock(${SCHEMA_LOCK})`;
    await t`
      CREATE TABLE IF NOT EXISTS manual_products (
        id          TEXT PRIMARY KEY,
        slug        TEXT NOT NULL UNIQUE,
        sku         TEXT NOT NULL,
        category    TEXT NOT NULL,
        name        JSONB NOT NULL,
        description JSONB NOT NULL,
        material    JSONB,
        price       BIGINT NOT NULL DEFAULT 0,
        old_price   BIGINT,
        sizes       JSONB NOT NULL DEFAULT '[]'::jsonb,
        stock       INTEGER NOT NULL DEFAULT 0,
        featured    BOOLEAN NOT NULL DEFAULT false,
        published   BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await t`
      CREATE TABLE IF NOT EXISTS manual_product_images (
        id           TEXT PRIMARY KEY,
        product_id   TEXT NOT NULL REFERENCES manual_products(id) ON DELETE CASCADE,
        position     INTEGER NOT NULL DEFAULT 0,
        content_type TEXT NOT NULL,
        data         BYTEA NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await t`CREATE INDEX IF NOT EXISTS manual_product_images_product_idx ON manual_product_images (product_id, position)`;
    await t`
      CREATE TABLE IF NOT EXISTS manual_settings (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
  });
}

export function isConfigured() {
  return Boolean(primaryDb());
}

export function hasMirror() {
  return Boolean(mirrorDb());
}

function requirePrimary(): Sql {
  const sql = primaryDb();
  if (!sql) throw new Error("DATABASE_URL sozlanmagan");
  return sql;
}

// ── O'qish ──────────────────────────────────────────────────────
type Row = Record<string, unknown>;

function rowToProduct(r: Row, imageIds: string[]): ManualProduct {
  return {
    id: String(r.id),
    slug: String(r.slug),
    sku: String(r.sku),
    category: String(r.category),
    name: r.name as Localized,
    description: r.description as Localized,
    material: (r.material as Localized | null) ?? null,
    price: Number(r.price),
    oldPrice: r.old_price == null ? null : Number(r.old_price),
    sizes: Array.isArray(r.sizes) ? (r.sizes as SizeRow[]) : [],
    stock: Number(r.stock),
    featured: Boolean(r.featured),
    published: Boolean(r.published),
    imageIds,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

async function imageIdsFor(sql: Sql, ids: string[]) {
  const map = new Map<string, string[]>();
  if (!ids.length) return map;
  const rows = await sql`
    SELECT id, product_id FROM manual_product_images
    WHERE product_id IN ${sql(ids)} ORDER BY position, created_at`;
  for (const r of rows) {
    const list = map.get(String(r.product_id)) ?? [];
    list.push(String(r.id));
    map.set(String(r.product_id), list);
  }
  return map;
}

export async function listManualProducts(opts: { publishedOnly?: boolean } = {}): Promise<ManualProduct[]> {
  const sql = primaryDb();
  if (!sql) return [];
  await ensureSchema(sql);
  const rows = opts.publishedOnly
    ? await sql`SELECT * FROM manual_products WHERE published ORDER BY created_at DESC`
    : await sql`SELECT * FROM manual_products ORDER BY created_at DESC`;
  const images = await imageIdsFor(sql, rows.map((r) => String(r.id)));
  return rows.map((r) => rowToProduct(r, images.get(String(r.id)) ?? []));
}

export async function getManualProduct(id: string): Promise<ManualProduct | null> {
  const sql = primaryDb();
  if (!sql) return null;
  await ensureSchema(sql);
  const [row] = await sql`SELECT * FROM manual_products WHERE id = ${id}`;
  if (!row) return null;
  const images = await imageIdsFor(sql, [id]);
  return rowToProduct(row, images.get(id) ?? []);
}

export async function getManualImage(id: string): Promise<NewImage | null> {
  const sql = primaryDb();
  if (!sql) return null;
  await ensureSchema(sql);
  const [row] = await sql`SELECT content_type, data FROM manual_product_images WHERE id = ${id}`;
  if (!row) return null;
  return { contentType: String(row.content_type), data: row.data as Buffer };
}

export async function getSettings(): Promise<Settings> {
  const sql = primaryDb();
  if (!sql) return { hideSamples: false };
  await ensureSchema(sql);
  const [row] = await sql`SELECT value FROM manual_settings WHERE key = 'hide_samples'`;
  return { hideSamples: row ? row.value === true : false };
}

// ── Yozish ──────────────────────────────────────────────────────
const newId = (bytes: number) => randomBytes(bytes).toString("hex");

/** Lotin harfli URL slug (o‘ g‘ va apostroflar tozalanadi). */
export function slugify(text: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
    ў: "o", қ: "q", ғ: "g", ҳ: "h",
  };
  const base = text
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bb\u02bc'`]/g, "")
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "mahsulot";
}

async function uniqueSlug(sql: Sql, wanted: string) {
  let slug = wanted;
  for (let i = 2; i < 200; i++) {
    const [hit] = await sql`SELECT 1 FROM manual_products WHERE slug = ${slug}`;
    if (!hit) return slug;
    slug = `${wanted}-${i}`;
  }
  return `${wanted}-${newId(3)}`;
}

/** JSONB ustunlar — postgres.js massivni PG massiv qilib yubormasligi uchun aniq json(). */
const JSON_COLS = ["name", "description", "material", "sizes"] as const;

function jsonify(sql: Sql, row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  for (const k of JSON_COLS) {
    if (k in out) out[k] = out[k] == null ? null : sql.json(out[k] as never);
  }
  return out;
}

function columns(input: ManualInput) {
  return {
    sku: input.sku ?? "",
    category: input.category,
    name: input.name,
    description: input.description,
    material: input.material,
    price: input.price,
    old_price: input.oldPrice,
    sizes: input.sizes,
    stock: input.stock,
    featured: input.featured,
    published: input.published,
  };
}

export interface SaveResult {
  product: ManualProduct;
  /** Bot bazasiga nusxalash natijasi: null — BOT_DATABASE_URL yo'q. */
  mirrored: boolean | null;
  mirrorError?: string;
}

/**
 * Mahsulotni yaratadi (id yo'q) yoki yangilaydi. Rasmlar `order` bo'yicha
 * joylashtiriladi; ro'yxatda yo'q eski rasmlar o'chiriladi.
 */
export async function saveManualProduct(
  id: string | null,
  input: ManualInput,
  uploads: NewImage[],
  order: ImageSlot[],
): Promise<SaveResult> {
  const sql = requirePrimary();
  await ensureSchema(sql);

  const productId = id ?? `m-${newId(6)}`;
  const uploadIds = uploads.map(() => newId(16));

  await sql.begin(async (tx) => {
    const t = tx as unknown as Sql;
    const cols = columns(input);
    if (!id) {
      const slug = await uniqueSlug(t, slugify(input.name.uz || input.name.ru || input.name.en));
      const sku = cols.sku || `M-${Date.now().toString(36).toUpperCase()}`;
      await t`INSERT INTO manual_products ${t(jsonify(t, { id: productId, slug, ...cols, sku }))}`;
    } else {
      const [exists] = await t`SELECT sku FROM manual_products WHERE id = ${productId}`;
      if (!exists) throw new Error("Mahsulot topilmadi");
      const sku = cols.sku || String(exists.sku);
      await t`UPDATE manual_products SET ${t(jsonify(t, { ...cols, sku }))}, updated_at = now() WHERE id = ${productId}`;
    }

    for (let i = 0; i < uploads.length; i++) {
      await t`INSERT INTO manual_product_images ${t({
        id: uploadIds[i]!,
        product_id: productId,
        position: 1000 + i,
        content_type: uploads[i]!.contentType,
        data: uploads[i]!.data,
      })}`;
    }

    const finalIds = order
      .map((slot) => ("existing" in slot ? slot.existing : uploadIds[slot.upload]))
      .filter((v): v is string => Boolean(v));
    if (finalIds.length) {
      await t`DELETE FROM manual_product_images WHERE product_id = ${productId} AND id NOT IN ${t(finalIds)}`;
    } else {
      await t`DELETE FROM manual_product_images WHERE product_id = ${productId}`;
    }
    for (let i = 0; i < finalIds.length; i++) {
      await t`UPDATE manual_product_images SET position = ${i} WHERE id = ${finalIds[i]!} AND product_id = ${productId}`;
    }
  });

  const product = (await getManualProduct(productId))!;
  const mirror = await replicateProduct(productId);
  return { product, ...mirror };
}

export async function deleteManualProduct(id: string) {
  const sql = requirePrimary();
  await ensureSchema(sql);
  await sql`DELETE FROM manual_products WHERE id = ${id}`;
  return mirrorRun(async (m) => {
    await m`DELETE FROM manual_products WHERE id = ${id}`;
  });
}

export async function saveSettings(settings: Settings) {
  const sql = requirePrimary();
  await ensureSchema(sql);
  const write = async (s: Sql) => {
    await s`
      INSERT INTO manual_settings (key, value) VALUES ('hide_samples', ${s.json(settings.hideSamples)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  };
  await write(sql);
  return mirrorRun(write);
}

// ── Bot bazasiga nusxalash ─────────────────────────────────────
async function mirrorRun(fn: (m: Sql) => Promise<void>): Promise<{ mirrored: boolean | null; mirrorError?: string }> {
  const m = mirrorDb();
  if (!m) return { mirrored: null };
  try {
    await ensureSchema(m);
    await fn(m);
    return { mirrored: true };
  } catch (err) {
    console.error("[manual-catalog] bot bazasiga yozilmadi:", err);
    return { mirrored: false, mirrorError: (err as Error).message };
  }
}

/** Bitta mahsulotni (rasmlari bilan) sayt bazasidan bot bazasiga to'liq ko'chiradi. */
async function copyProduct(src: Sql, dst: Sql, id: string) {
  const [row] = await src`SELECT * FROM manual_products WHERE id = ${id}`;
  if (!row) {
    await dst`DELETE FROM manual_products WHERE id = ${id}`;
    return;
  }
  const images = await src`SELECT id, position, content_type, data FROM manual_product_images WHERE product_id = ${id}`;
  await dst.begin(async (tx) => {
    const t = tx as unknown as Sql;
    const data = jsonify(t, { ...row } as Record<string, unknown>);
    // Boshqa mahsulot shu slug'ni egallagan bo'lsa (eski nusxa) — to'qnashuvni yo'qotamiz.
    await t`DELETE FROM manual_products WHERE slug = ${String(row.slug)} AND id <> ${id}`;
    await t`
      INSERT INTO manual_products ${t(data)}
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug, sku = EXCLUDED.sku, category = EXCLUDED.category, name = EXCLUDED.name,
        description = EXCLUDED.description, material = EXCLUDED.material, price = EXCLUDED.price,
        old_price = EXCLUDED.old_price, sizes = EXCLUDED.sizes, stock = EXCLUDED.stock,
        featured = EXCLUDED.featured, published = EXCLUDED.published, updated_at = EXCLUDED.updated_at`;
    const ids = images.map((i) => String(i.id));
    if (ids.length) await t`DELETE FROM manual_product_images WHERE product_id = ${id} AND id NOT IN ${t(ids)}`;
    else await t`DELETE FROM manual_product_images WHERE product_id = ${id}`;
    for (const img of images) {
      await t`
        INSERT INTO manual_product_images ${t({
          id: String(img.id),
          product_id: id,
          position: Number(img.position),
          content_type: String(img.content_type),
          data: img.data as Buffer,
        })}
        ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position`;
    }
  });
}

async function replicateProduct(id: string) {
  const src = requirePrimary();
  return mirrorRun((dst) => copyProduct(src, dst, id));
}

/** To'liq sinxronlash: bot bazasini sayt bazasi bilan bir xil holatga keltiradi. */
export async function syncMirror() {
  const src = requirePrimary();
  await ensureSchema(src);
  return mirrorRun(async (dst) => {
    const ids = (await src`SELECT id FROM manual_products`).map((r) => String(r.id));
    if (ids.length) await dst`DELETE FROM manual_products WHERE id NOT IN ${dst(ids)}`;
    else await dst`DELETE FROM manual_products`;
    for (const id of ids) await copyProduct(src, dst, id);
    const [setting] = await src`SELECT value FROM manual_settings WHERE key = 'hide_samples'`;
    await dst`
      INSERT INTO manual_settings (key, value) VALUES ('hide_samples', ${dst.json(setting ? setting.value === true : false)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  });
}
