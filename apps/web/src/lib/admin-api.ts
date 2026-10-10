import "server-only";

import { revalidatePath } from "next/cache";
import { getCatalog } from "@/lib/catalog/provider";
import { invalidateManualCache } from "@/lib/catalog/combined-provider";
import type { Localized } from "@/lib/catalog/types";
import { saveManualProduct, type ManualInput, type NewImage } from "@/lib/manual-catalog";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, productSchema } from "@/lib/admin-schema";

export const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Bo'sh tarjimalarni o'zbekchasi bilan to'ldiradi. */
function fill(v: { uz: string; ru: string; en: string }): Localized {
  return { uz: v.uz, ru: v.ru || v.uz, en: v.en || v.uz };
}

/** Rasm faylning haqiqiy formatini baytlaridan tekshiradi (faqat Content-Type'ga ishonmaymiz). */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 4, 8) === "ftyp" && /avi[fs]/.test(buf.toString("ascii", 8, 12))) return "image/avif";
  return null;
}

/** Saytdagi barcha katalog sahifalarini darhol yangilash. */
export function refreshSite() {
  invalidateManualCache();
  revalidatePath("/", "layout");
}

/** multipart/form-data: `data` (JSON) + `images` (fayllar) → saqlash. */
export async function handleSave(req: Request, id: string | null): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: "Forma o‘qilmadi" }, 400);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data") ?? "{}"));
  } catch {
    return json({ ok: false, error: "Noto‘g‘ri ma’lumot" }, 400);
  }
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return json({ ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "Xato" }, 422);
  }
  const p = parsed.data;

  const categories = await (await getCatalog()).listCategories();
  if (!categories.some((c) => c.slug === p.category)) {
    return json({ ok: false, error: "Bunday kategoriya yo‘q" }, 422);
  }
  if (p.oldPrice != null && p.oldPrice > 0 && p.oldPrice <= p.price) {
    return json({ ok: false, error: "Eski narx joriy narxdan katta bo‘lishi kerak" }, 422);
  }
  const labels = p.sizes.map((s) => s.label.toLowerCase());
  if (new Set(labels).size !== labels.length) {
    return json({ ok: false, error: "O‘lchamlar takrorlanmasin" }, 422);
  }

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_IMAGES) return json({ ok: false, error: `Ko‘pi bilan ${MAX_IMAGES} ta rasm` }, 422);
  const uploads: NewImage[] = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return json({ ok: false, error: `“${file.name}” juda katta (6 MB dan oshmasin)` }, 413);
    }
    const data = Buffer.from(await file.arrayBuffer());
    const type = sniff(data);
    if (!type || !IMAGE_TYPES.includes(type)) {
      return json({ ok: false, error: `“${file.name}” — rasm formati qo‘llab-quvvatlanmaydi (JPG, PNG, WEBP)` }, 415);
    }
    uploads.push({ contentType: type, data });
  }
  const order = p.imageOrder.filter((slot) => !("upload" in slot) || slot.upload < uploads.length);
  if (order.length > MAX_IMAGES) return json({ ok: false, error: `Ko‘pi bilan ${MAX_IMAGES} ta rasm` }, 422);

  const input: ManualInput = {
    sku: p.sku || undefined,
    category: p.category,
    name: fill(p.name),
    description: fill(p.description),
    material: p.material.uz ? fill(p.material) : null,
    price: p.price,
    oldPrice: p.oldPrice && p.oldPrice > 0 ? p.oldPrice : null,
    sizes: p.sizes,
    stock: p.sizes.length ? p.sizes.reduce((s, x) => s + x.stock, 0) : p.stock,
    featured: p.featured,
    published: p.published,
  };

  try {
    const res = await saveManualProduct(id, input, uploads, order);
    refreshSite();
    return json({ ok: true, id: res.product.id, slug: res.product.slug, mirrored: res.mirrored, mirrorError: res.mirrorError });
  } catch (err) {
    const message = (err as Error).message;
    console.error("[admin] saqlash xatosi:", err);
    return json({ ok: false, error: message === "Mahsulot topilmadi" ? message : "Bazaga saqlashda xato" }, message === "Mahsulot topilmadi" ? 404 : 500);
  }
}
