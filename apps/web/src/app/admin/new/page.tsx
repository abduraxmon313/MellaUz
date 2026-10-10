import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getCatalog } from "@/lib/catalog/provider";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yangi mahsulot" };

export default async function NewProductPage() {
  await requireAdminPage();
  const categories = (await (await getCatalog()).listCategories()).map((c) => ({ slug: c.slug, name: c.name.uz }));
  return (
    <AdminShell>
      <Link href="/admin" className="btn-link">← Mahsulotlar</Link>
      <h1 className="h-page mt-4 mb-8 text-brown">Yangi mahsulot</h1>
      <ProductEditor product={null} categories={categories} />
    </AdminShell>
  );
}
