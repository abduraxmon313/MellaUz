import "server-only";

import type { CatalogProvider } from "./provider";
import type { Category, ListProductsOptions, Product } from "./types";
import { categories, products } from "./mock-data";

/** Namuna (mock) katalog provayderi — xotiradagi ma'lumot bilan ishlaydi. */
export class MockCatalogProvider implements CatalogProvider {
  async listCategories(): Promise<Category[]> {
    return [...categories].sort((a, b) => a.order - b.order);
  }

  async listProducts(options: ListProductsOptions = {}): Promise<Product[]> {
    let result = products;
    if (options.category) {
      result = result.filter((p) => p.categorySlug === options.category);
    }
    if (options.featured) {
      result = result.filter((p) => p.featured);
    }
    if (options.limit && options.limit > 0) {
      result = result.slice(0, options.limit);
    }
    return result;
  }

  async getProduct(slug: string): Promise<Product | null> {
    return products.find((p) => p.slug === slug) ?? null;
  }

  async getCategory(slug: string): Promise<Category | null> {
    return categories.find((c) => c.slug === slug) ?? null;
  }
}
