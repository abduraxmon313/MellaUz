import { z } from "zod";

/** Bitta til matni; ru/en bo'sh bo'lsa — o'zbekchasi ishlatiladi. */
const text = (max: number) => z.string().trim().max(max).default("");

const localized = (max: number, required: boolean) =>
  z
    .object({ uz: text(max), ru: text(max), en: text(max) })
    .refine((v) => !required || v.uz.length > 0, { message: "O‘zbekcha matn majburiy" });

const money = z.coerce.number().int().min(0).max(1_000_000_000);

export const productSchema = z.object({
  sku: z.string().trim().max(40).optional().default(""),
  category: z.string().trim().min(1, "Kategoriyani tanlang").max(60),
  name: localized(140, true),
  description: localized(3000, false).default({ uz: "", ru: "", en: "" }),
  material: localized(300, false).default({ uz: "", ru: "", en: "" }),
  price: money,
  oldPrice: money.nullable().optional().default(null),
  sizes: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(20),
        stock: z.coerce.number().int().min(0).max(100_000),
      }),
    )
    .max(40)
    .default([]),
  stock: z.coerce.number().int().min(0).max(100_000).default(0),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  imageOrder: z
    .array(z.union([z.object({ existing: z.string().regex(/^[a-f0-9]{32}$/) }), z.object({ upload: z.number().int().min(0).max(20) })]))
    .max(12)
    .default([]),
});

export type ProductPayload = z.infer<typeof productSchema>;

export const MAX_IMAGES = 12;
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
