import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getCatalog } from "@/lib/catalog/provider";
import { formatPrice } from "@/lib/format";
import { getSettings, hasMirror, isConfigured, listManualProducts } from "@/lib/manual-catalog";
import { AdminShell } from "@/components/admin/AdminShell";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { SavedNotice } from "@/components/admin/SavedNotice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mahsulotlar" };

export default async function AdminHome() {
  await requireAdminPage();

  const configured = isConfigured();
  let error = "";
  let products: Awaited<ReturnType<typeof listManualProducts>> = [];
  let settings = { hideSamples: false };
  if (configured) {
    try {
      [products, settings] = await Promise.all([listManualProducts(), getSettings()]);
    } catch (err) {
      error = (err as Error).message;
    }
  }
  const categories = await (await getCatalog()).listCategories();
  const catName = (slug: string) => categories.find((c) => c.slug === slug)?.name.uz ?? slug;

  return (
    <AdminShell>
      <SavedNotice />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Qo‘lda kiritilgan katalog</p>
          <h1 className="h-page mt-2 text-brown">Mahsulotlar</h1>
          <p className="mt-1.5 text-sm text-muted">
            Bu yerda qo‘shilgan mahsulotlar saytda va Telegram Mini App’da ko‘rinadi.
          </p>
        </div>
        {configured && !error && (
          <Link href="/admin/new" className="btn btn-primary">
            + Mahsulot qo‘shish
          </Link>
        )}
      </div>

      {!configured && (
        <div className="alert-error mt-8" role="alert">
          <div>
            <b>DATABASE_URL sozlanmagan.</b> Railway’da mella-web servisiga PostgreSQL ulang
            (Variables → <code>DATABASE_URL</code>), so‘ng qayta deploy qiling.
          </div>
        </div>
      )}
      {error && (
        <p className="alert-error mt-8" role="alert">
          Bazaga ulanib bo‘lmadi: {error}
        </p>
      )}

      {configured && !error && (
        <>
          <SettingsPanel hideSamples={settings.hideSamples} mirror={hasMirror()} />

          {products.length === 0 ? (
            <div className="card mt-6 px-6 py-14 text-center">
              <p className="font-display text-2xl text-brown">Hali mahsulot qo‘shilmagan</p>
              <p className="mt-2 text-sm text-muted">Birinchi mahsulotingizni rasmlari bilan qo‘shing.</p>
              <Link href="/admin/new" className="btn btn-primary mt-6">
                + Mahsulot qo‘shish
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {products.map((p) => {
                const stock = p.sizes.length ? p.sizes.reduce((s, x) => s + x.stock, 0) : p.stock;
                return (
                  <li key={p.id} className="card flex flex-wrap items-center gap-4 p-3 sm:flex-nowrap sm:p-4">
                    <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-ivory">
                      {p.imageIds[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/media/${p.imageIds[0]}`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] text-muted">Rasm yo‘q</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-bronze">
                        {catName(p.category)} · {p.sku}
                      </p>
                      <p className="mt-0.5 truncate font-display text-xl text-brown">{p.name.uz}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        <span className="font-semibold tabular-nums text-brown">{formatPrice(p.price, "uz")} so‘m</span>
                        {" · "}qoldiq {stock}
                        {p.sizes.length > 0 && ` · o‘lcham: ${p.sizes.map((s) => s.label).join(", ")}`}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span
                          className={`badge ${p.published ? "bg-success/10 text-success" : "bg-brown/[0.06] text-muted"}`}
                        >
                          {p.published ? "Ko‘rinadi" : "Yashirin"}
                        </span>
                        {p.featured && <span className="badge bg-gold/25 text-brown">Bosh sahifada</span>}
                        {stock === 0 && <span className="badge bg-error/10 text-error">Qoldiq yo‘q</span>}
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
                      <Link href={`/admin/${p.id}`} className="btn btn-secondary btn-sm">
                        Tahrirlash
                      </Link>
                      {p.published && (
                        <a href={`/uz/product/${p.slug}`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">
                          Saytda
                        </a>
                      )}
                      <DeleteProductButton id={p.id} name={p.name.uz} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </AdminShell>
  );
}
