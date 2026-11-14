import type { Locale } from "@/i18n/config";

/** Ko'p tilli matn (ERP ham shu shaklda bersa, to'g'ridan-to'g'ri mos keladi). */
export type Localized = Record<Locale, string>;

export interface Category {
  /** URL uchun barqaror identifikator, masalan "poyabzal" */
  slug: string;
  name: Localized;
  /** Qisqa tavsif (ixtiyoriy) */
  tagline?: Localized;
  /** Muqova rasmi (public/ ichidagi yo'l yoki to'liq URL) */
  image: string;
  order: number;
}

export interface Product {
  /** URL uchun barqaror identifikator */
  slug: string;
  /** ERP dagi artikul / SKU */
  sku: string;
  name: Localized;
  description: Localized;
  /** Material tavsifi (ixtiyoriy) */
  material?: Localized;
  /** Brend (BILLZ). */
  brand?: string;
  /** Xususiyatlar har til uchun (rang, material…) — Mini App katalogidan. */
  specs?: Partial<Record<Locale, { name: string; value: string }[]>>;
  /** Mini App (bot) katalogidagi ID — eski havolalar uchun. */
  botId?: string;
  categorySlug: string;
  /** Narx — so'mda (butun son). 0 bo'lsa "narx so'rov bo'yicha". */
  price: number;
  /** Chegirmagacha bo'lgan narx (ixtiyoriy) */
  oldPrice?: number;
  /** Qoldiq. ERP'dan keladi; 0 => "vaqtincha yo'q". */
  stock: number;
  images: string[];
  featured?: boolean;
  /** O'lchamlar (masalan 36…40) — admin panelda kiritiladi. */
  sizes?: { label: string; inStock: boolean }[];
  /** ERP yangilagan vaqt (ixtiyoriy, kelajakda sinxronlash uchun) */
  updatedAt?: string;
}

/** Bitta tilga "siqilgan" mahsulot — UI komponentlariga qulay shakl. */
export interface ProductView {
  slug: string;
  sku: string;
  name: string;
  description: string;
  material?: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  oldPrice?: number;
  inStock: boolean;
  images: string[];
  sizes: { label: string; inStock: boolean }[];
  brand?: string;
  specs: { name: string; value: string }[];
}

export interface CategoryView {
  slug: string;
  name: string;
  tagline?: string;
  image: string;
}

export interface ListProductsOptions {
  category?: string;
  featured?: boolean;
  limit?: number;
}
