import type { CatalogSnapshot, Product, Variant } from "./types.js";
import { categories as mockCategories, products as mockProducts } from "./mock-source.js";

/**
 * BILLZ ulanmaguncha ishlatiladigan namuna katalog.
 * Oyoq kiyimlarga o'lcham variantlari qo'shilgan — Mini App'dagi o'lcham
 * tanlagichini BILLZ'siz ham sinab ko'rish uchun.
 */
const SHOE_SIZES = ["36", "37", "38", "39", "40"];

export function buildMockSnapshot(): CatalogSnapshot {
  const products: Product[] = mockProducts.map((p, idx) => {
    const isShoe = p.categorySlug === "poyabzal";
    let variants: Variant[];
    if (isShoe) {
      // Qoldiqni o'lchamlarga taqsimlaymiz (deterministik).
      variants = SHOE_SIZES.map((size, i) => ({
        id: `${p.sku}-${size}`,
        label: size,
        sku: `${p.sku}-${size}`,
        barcode: "",
        price: p.price,
        oldPrice: p.oldPrice ?? null,
        stock: p.stock === 0 ? 0 : Math.max(0, Math.round(p.stock / SHOE_SIZES.length) + ((i + idx) % 3) - 1),
      }));
    } else {
      variants = [
        { id: p.sku, label: "", sku: p.sku, barcode: "", price: p.price, oldPrice: p.oldPrice ?? null, stock: p.stock },
      ];
    }
    const description: Record<string, string> = {};
    for (const l of ["uz", "ru", "en"] as const) {
      const d = p.description[l];
      const m = p.material?.[l];
      description[l] = m ? `${d}\n\n${m}` : d;
    }
    return {
      id: p.sku,
      name: p.name,
      description,
      brand: "MELLA",
      sku: p.sku,
      categoryIds: [p.categorySlug],
      images: p.images,
      variants,
      attributeNames: [],
      featured: Boolean(p.featured),
      updatedAt: new Date(Date.now() - idx * 86_400_000).toISOString(),
    };
  });

  return {
    source: "mock",
    syncedAt: new Date().toISOString(),
    categories: mockCategories.map((c) => ({ id: c.slug, name: c.name, order: c.order })),
    products,
  };
}
