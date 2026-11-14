import type { Category } from "./types";

/**
 * Sayt /admin panelida qo'lda kiritiladigan mahsulotlar kategoriyalari (eski, vaqtinchalik rejim).
 * Asosiy katalog endi Mini App'dan (BILLZ) keladi — bu ro'yxat faqat admin panel uchun.
 */
export const manualCategories: Category[] = [
  { slug: "poyabzal", order: 1, image: "", name: { uz: "Oyoq kiyim", ru: "Обувь", en: "Footwear" } },
  { slug: "sumkalar", order: 2, image: "", name: { uz: "Sumkalar", ru: "Сумки", en: "Bags" } },
  { slug: "kiyim", order: 3, image: "", name: { uz: "Kiyim-kechak", ru: "Одежда", en: "Clothing" } },
  { slug: "aksessuarlar", order: 4, image: "", name: { uz: "Aksessuarlar", ru: "Аксессуары", en: "Accessories" } },
];
