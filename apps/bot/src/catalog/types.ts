/**
 * Mini App katalogining ichki modeli.
 *
 * BILLZ'da variativ tovar (masalan tufli) = ota tovar + o'lcham/rang bo'yicha
 * variatsiyalar. Mini App'da bitta karta = bitta ota tovar, ichida esa
 * variantlar (o'lcham tanlash) bo'ladi. Oddiy tovar — bitta variantli karta.
 */

export type Lang = "uz" | "ru" | "en";
export type Localized = string | Partial<Record<Lang, string>>;

export interface Variant {
  /** BILLZ tovar ID'si (variatsiya yoki oddiy tovar) — buyurtma shu bilan saqlanadi. */
  id: string;
  /** Masalan: "38" yoki "Qora / 38". Oddiy tovarda bo'sh. */
  label: string;
  sku: string;
  barcode: string;
  price: number;
  oldPrice: number | null;
  stock: number;
}

export interface Product {
  /** Karta ID'si (ota tovar ID'si yoki oddiy tovar ID'si). */
  id: string;
  name: Localized;
  description: Localized;
  brand: string;
  sku: string;
  categoryIds: string[];
  /** Asl rasm havolalari (BILLZ CDN yoki lokal). Mijozga /img/... orqali beriladi. */
  images: string[];
  variants: Variant[];
  /** Atribut nomlari (masalan "O'lcham") — variant tanlagich sarlavhasi uchun. */
  attributeNames: string[];
  featured: boolean;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: Localized;
  order: number;
}

export interface CatalogSnapshot {
  source: "billz" | "mock";
  syncedAt: string;
  categories: Category[];
  products: Product[];
}
