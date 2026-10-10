import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { getCatalog } from "@/lib/catalog/provider";
import { getManualProduct } from "@/lib/manual-catalog";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tahrirlash" };

const l3 = (v: Record<string, string> | null | undefined) => ({ uz: v?.uz ?? "", ru: v?.ru ?? "", en: v?.en ?? "" });

export default async function EditProductPage({ params }: PageProps<"/admin/[id]">) {
  await requireAdminPage();
  const { id } = await params;
  if (!/^m-[a-f0-9]{12}$/.test(id)) notFound();
  const product = await getManualProduct(id);
  if (!product) notFound();
  const categories = (await (await getCatalog()).listCategories()).map((c) => ({ slug: c.slug, name: c.name.uz }));

  // ru/en o'zbekcha bilan bir xil bo'lsa — tahrirlashda bo'sh ko'rsatamiz (avto-to'ldirilgan).
  const own = (v: Record<string, string> | null) => {
    const t = l3(v);
    return { uz: t.uz, ru: t.ru === t.uz ? "" : t.ru, en: t.en === t.uz ? "" : t.en };
  };

  return (
    <AdminShell>
      <Link href="/admin" className="btn-link">← Mahsulotlar</Link>
      <h1 className="h-page mt-4 mb-8 text-brown">{product.name.uz}</h1>
      <ProductEditor
        categories={categories}
        product={{
          id: product.id,
          sku: product.sku,
          category: product.category,
          name: own(product.name),
          description: own(product.description),
          material: product.material ? own(product.material) : null,
          price: product.price,
          oldPrice: product.oldPrice,
          sizes: product.sizes,
          stock: product.stock,
          featured: product.featured,
          published: product.published,
          imageIds: product.imageIds,
        }}
      />
    </AdminShell>
  );
}
