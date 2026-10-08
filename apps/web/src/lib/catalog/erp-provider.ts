import "server-only";

import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import type { CatalogProvider } from "./provider";
import type { Category, ListProductsOptions, Localized, Product } from "./types";

/**
 * ERP (HTTP) katalog provayderi — SKELET.
 *
 * ⚠️ Bu fayl faqat `ERP_API_BASE_URL` env o'rnatilgan bo'lsa ishga tushadi.
 * ERP tizimi aniqlangach (API manzili, autentifikatsiya, javob formati),
 * `mapCategory` / `mapProduct` funksiyalarini real javobga moslang —
 * qolgan ilova kodi (sahifalar, komponentlar) o'zgarmaydi.
 *
 * Kutilayotgan env:
 *   ERP_API_BASE_URL   — masalan https://erp.example.uz/api
 *   ERP_API_KEY        — Bearer token / API kalit (ixtiyoriy)
 *   ERP_CACHE_SECONDS  — javoblarni keshlash muddati (default 300s)
 */
export class ErpCatalogProvider implements CatalogProvider {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly revalidate: number;

  constructor() {
    this.baseUrl = (process.env.ERP_API_BASE_URL ?? "").replace(/\/+$/, "");
    this.apiKey = process.env.ERP_API_KEY || undefined;
    this.revalidate = Number(process.env.ERP_CACHE_SECONDS ?? 300);
  }

  private async request<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      headers,
      next: { revalidate: this.revalidate, tags: ["catalog"] },
    });
    if (!res.ok) {
      throw new Error(`ERP so'rovi muvaffaqiyatsiz: ${res.status} ${path}`);
    }
    return (await res.json()) as T;
  }

  async listCategories(): Promise<Category[]> {
    const raw = await this.request<unknown[]>("/categories");
    return raw.map((item) => mapCategory(item)).sort((a, b) => a.order - b.order);
  }

  async listProducts(options: ListProductsOptions = {}): Promise<Product[]> {
    const params = new URLSearchParams();
    if (options.category) params.set("category", options.category);
    if (options.featured) params.set("featured", "1");
    if (options.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    const raw = await this.request<unknown[]>(`/products${qs ? `?${qs}` : ""}`);
    return raw.map((item) => mapProduct(item));
  }

  async getProduct(slug: string): Promise<Product | null> {
    try {
      const raw = await this.request<unknown>(`/products/${encodeURIComponent(slug)}`);
      return raw ? mapProduct(raw) : null;
    } catch {
      return null;
    }
  }

  async getCategory(slug: string): Promise<Category | null> {
    try {
      const raw = await this.request<unknown>(`/categories/${encodeURIComponent(slug)}`);
      return raw ? mapCategory(raw) : null;
    } catch {
      return null;
    }
  }
}

// ── ERP javobini bizning tiplarga o'girish (moslashtiring) ───────────

type Rec = Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * ERP matn maydonini ko'p tilli shaklga keltiradi.
 * Agar ERP bitta satr bersa — uch tilga ham o'sha qiymat qo'yiladi.
 * Agar `{uz,ru,en}` obyekt bersa — to'g'ridan-to'g'ri olinadi.
 */
function localized(value: unknown): Localized {
  if (value && typeof value === "object") {
    const obj = value as Rec;
    const out = {} as Localized;
    for (const l of locales) out[l] = str(obj[l], str(obj.uz));
    return out;
  }
  const s = str(value);
  return locales.reduce((acc, l) => {
    acc[l] = s;
    return acc;
  }, {} as Localized);
}

function mapCategory(item: unknown): Category {
  const c = (item ?? {}) as Rec;
  return {
    slug: str(c.slug ?? c.id),
    name: localized(c.name),
    tagline: c.tagline ? localized(c.tagline) : undefined,
    image: str(c.image ?? c.imageUrl),
    order: num(c.order, 999),
  };
}

function mapProduct(item: unknown): Product {
  const p = (item ?? {}) as Rec;
  const images = Array.isArray(p.images)
    ? (p.images as unknown[]).map((i) => str(i)).filter(Boolean)
    : [str(p.image ?? p.imageUrl)].filter(Boolean);

  return {
    slug: str(p.slug ?? p.id),
    sku: str(p.sku ?? p.article ?? p.id),
    name: localized(p.name),
    description: localized(p.description),
    material: p.material ? localized(p.material) : undefined,
    categorySlug: str(p.categorySlug ?? p.category),
    price: num(p.price),
    oldPrice: p.oldPrice != null ? num(p.oldPrice) : undefined,
    stock: num(p.stock ?? p.quantity),
    images,
    featured: Boolean(p.featured),
    updatedAt: p.updatedAt ? str(p.updatedAt) : undefined,
  };
}
