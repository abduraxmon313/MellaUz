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
  categorySlug: string;
  /** Narx — so'mda (butun son). 0 bo'lsa "narx so'rov bo'yicha". */
  price: number;
  /** Chegirmagacha bo'lgan narx (ixtiyoriy) */
  oldPrice?: number;
  /** Qoldiq. ERP'dan keladi; 0 => "vaqtincha yo'q". */
  stock: number;
  images: string[];
  featured?: boolean;
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
