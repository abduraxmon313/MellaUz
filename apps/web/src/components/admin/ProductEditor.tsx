"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type L3 = { uz: string; ru: string; en: string };
type Lang = keyof L3;
type Size = { label: string; stock: string };
type Img = { key: string; kind: "existing"; id: string; url: string } | { key: string; kind: "new"; file: File; url: string };

export interface EditorProduct {
  id: string;
  sku: string;
  category: string;
  name: L3;
  description: L3;
  material: L3 | null;
  price: number;
  oldPrice: number | null;
  sizes: { label: string; stock: number }[];
  stock: number;
  featured: boolean;
  published: boolean;
  imageIds: string[];
}

const LANGS: { code: Lang; label: string }[] = [
  { code: "uz", label: "O‘zbekcha" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

const PRESETS: Record<string, string[]> = {
  "Poyabzal 35–41": ["35", "36", "37", "38", "39", "40", "41"],
  "Kiyim XS–XL": ["XS", "S", "M", "L", "XL"],
  "Kiyim 42–52": ["42", "44", "46", "48", "50", "52"],
};

const MAX_IMAGES = 12;
const MAX_SIDE = 1800;
const empty: L3 = { uz: "", ru: "", en: "" };
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 10);
const pretty = (v: string) => (v ? Number(v).toLocaleString("ru-RU").replace(/,/g, " ") : "");

/**
 * Rasmni brauzerda kichraytiradi (eng uzun tomoni 1800px, WEBP) — baza yengil,
 * sayt va Mini App tez ochiladi. Natija kattaroq chiqsa — asl fayl qoldiriladi.
 */
async function compress(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

export function ProductEditor({
  product,
  categories,
}: {
  product: EditorProduct | null;
  categories: { slug: string; name: string }[];
}) {
  const uid = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<Lang>("uz");
  const [name, setName] = useState<L3>(product?.name ?? empty);
  const [description, setDescription] = useState<L3>(product?.description ?? empty);
  const [material, setMaterial] = useState<L3>(product?.material ?? empty);
  const [category, setCategory] = useState(product?.category ?? categories[0]?.slug ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [oldPrice, setOldPrice] = useState(product?.oldPrice ? String(product.oldPrice) : "");
  const [hasSizes, setHasSizes] = useState(Boolean(product?.sizes.length));
  const [sizes, setSizes] = useState<Size[]>(
    product?.sizes.length ? product.sizes.map((s) => ({ label: s.label, stock: String(s.stock) })) : [],
  );
  const [stock, setStock] = useState(product ? String(product.stock) : "1");
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [published, setPublished] = useState(product?.published ?? true);
  const [images, setImages] = useState<Img[]>(
    (product?.imageIds ?? []).map((id) => ({ key: id, kind: "existing", id, url: `/api/media/${id}` })),
  );
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Yangi rasmlarning vaqtinchalik (blob:) URL'lari — sahifadan chiqqanda tozalanadi.
  const blobUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = blobUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const blobUrl = (file: File) => {
    const u = URL.createObjectURL(file);
    blobUrls.current.add(u);
    return u;
  };

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const room = MAX_IMAGES - images.length;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (!files.length) {
      setError(room <= 0 ? `Ko‘pi bilan ${MAX_IMAGES} ta rasm` : "Faqat rasm fayllarini tanlang");
      return;
    }
    setProcessing(true);
    const ready = await Promise.all(files.map(compress));
    setImages((prev) => [
      ...prev,
      ...ready.map((file) => ({ key: crypto.randomUUID(), kind: "new" as const, file, url: blobUrl(file) })),
    ]);
    setProcessing(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function move(index: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j]!, next[index]!];
      return next;
    });
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const img = prev[index];
      if (img?.kind === "new") {
        URL.revokeObjectURL(img.url);
        blobUrls.current.delete(img.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  function applyPreset(labels: string[]) {
    setHasSizes(true);
    setSizes((prev) => {
      const have = new Map(prev.map((s) => [s.label, s.stock]));
      return labels.map((label) => ({ label, stock: have.get(label) ?? "1" }));
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (name.uz.trim().length < 2) e.name = "Nomini o‘zbekcha yozing";
    if (!category) e.category = "Kategoriyani tanlang";
    if (!price) e.price = "Narxni kiriting";
    if (oldPrice && Number(oldPrice) <= Number(price)) e.oldPrice = "Eski narx joriy narxdan katta bo‘lsin";
    if (hasSizes) {
      const filled = sizes.filter((s) => s.label.trim());
      if (!filled.length) e.sizes = "Kamida bitta o‘lcham qo‘shing yoki “O‘lchamsiz”ni tanlang";
      const labels = filled.map((s) => s.label.trim().toLowerCase());
      if (new Set(labels).size !== labels.length) e.sizes = "O‘lchamlar takrorlanmasin";
    }
    if (!images.length) e.images = "Kamida bitta rasm qo‘shing";
    setFieldErrors(e);
    if (e.name) setLang("uz");
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (!validate()) {
      setError("Belgilangan maydonlarni to‘g‘rilang");
      return;
    }
    setBusy(true);
    const form = new FormData();
    const uploads = images.filter((i): i is Extract<Img, { kind: "new" }> => i.kind === "new");
    uploads.forEach((i) => form.append("images", i.file));
    form.append(
      "data",
      JSON.stringify({
        sku,
        category,
        name,
        description,
        material,
        price: Number(price || 0),
        oldPrice: oldPrice ? Number(oldPrice) : null,
        sizes: hasSizes
          ? sizes.filter((s) => s.label.trim()).map((s) => ({ label: s.label.trim(), stock: Number(s.stock || 0) }))
          : [],
        stock: Number(stock || 0),
        featured,
        published,
        imageOrder: images.map((i) => (i.kind === "existing" ? { existing: i.id } : { upload: uploads.indexOf(i) })),
      }),
    );
    try {
      const res = await fetch(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
        method: product ? "PUT" : "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        mirrored?: boolean | null;
        mirrorError?: string;
      };
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok || !body.ok) throw new Error(body.error || `Saqlab bo‘lmadi (${res.status})`);
      const q = new URLSearchParams({ saved: "1", mirror: String(body.mirrored) });
      if (body.mirrorError) q.set("mirrorError", body.mirrorError.slice(0, 160));
      router.push(`/admin?${q}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const totalStock = hasSizes ? sizes.reduce((s, x) => s + Number(x.stock || 0), 0) : Number(stock || 0);
  const err = (k: string) =>
    fieldErrors[k] ? (
      <p id={`${uid}-${k}-err`} className="field-error" role="alert">
        {fieldErrors[k]}
      </p>
    ) : null;
  const described = (k: string) => (fieldErrors[k] ? `${uid}-${k}-err` : undefined);

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {/* ── Rasmlar ── */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl text-brown">Rasmlar</h2>
          <p className="text-xs text-muted">
            Birinchi rasm — asosiy. {images.length}/{MAX_IMAGES}
          </p>
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((img, i) => (
            <li key={img.key} className="group relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-line bg-ivory">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={`Rasm ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && <span className="badge absolute left-1.5 top-1.5 bg-brown text-cream">Asosiy</span>}
              </div>
              <div className="mt-1.5 flex justify-between gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Chapga" className="icon-btn h-8 w-8 disabled:opacity-30">
                  ‹
                </button>
                <button type="button" onClick={() => removeImage(i)} aria-label={`Rasm ${i + 1} ni o‘chirish`} className="icon-btn h-8 w-8 text-error">
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === images.length - 1}
                  aria-label="O‘ngga"
                  className="icon-btn h-8 w-8 disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </li>
          ))}
          {images.length < MAX_IMAGES && (
            <li>
              <label
                htmlFor={`${uid}-files`}
                className={`flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center text-xs font-medium transition-colors hover:border-bronze hover:bg-ivory ${
                  fieldErrors.images ? "border-error text-error" : "border-line-strong text-muted"
                }`}
              >
                {processing ? <span className="spinner" aria-hidden /> : <span className="text-2xl leading-none">+</span>}
                {processing ? "Tayyorlanmoqda…" : "Rasm qo‘shish"}
              </label>
              <input
                ref={fileRef}
                id={`${uid}-files`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="sr-only"
                onChange={(e) => addFiles(e.target.files)}
                aria-describedby={described("images")}
              />
            </li>
          )}
        </ul>
        {err("images")}
        <p className="mt-3 text-xs text-muted">JPG, PNG yoki WEBP. Rasmlar avtomatik kichraytiriladi va bazada saqlanadi.</p>
      </section>

      {/* ── Asosiy ma'lumot ── */}
      <section className="card space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-brown">Ma’lumot</h2>
          <div className="inline-flex rounded-full border border-line bg-paper p-1" role="tablist" aria-label="Til">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                role="tab"
                aria-selected={lang === l.code}
                onClick={() => setLang(l.code)}
                className={`h-8 rounded-full px-3 text-xs font-semibold transition-colors ${
                  lang === l.code ? "bg-brown text-cream" : "text-muted hover:bg-ivory hover:text-brown"
                }`}
              >
                {l.label}
                {l.code === "uz" && " *"}
              </button>
            ))}
          </div>
        </div>
        {lang !== "uz" && (
          <p className="rounded-xl bg-ivory px-3 py-2 text-xs text-muted">
            Bo‘sh qoldirilsa, o‘zbekcha matn ko‘rsatiladi.
          </p>
        )}

        <div>
          <label htmlFor={`${uid}-name`} className="field-label">
            Nomi {lang === "uz" && <span className="text-bronze">*</span>}
          </label>
          <input
            id={`${uid}-name`}
            className="field-input"
            value={name[lang]}
            maxLength={140}
            placeholder={lang === "uz" ? "Masalan: Samarqand klassik tufli" : name.uz}
            onChange={(e) => setName({ ...name, [lang]: e.target.value })}
            aria-invalid={lang === "uz" && Boolean(fieldErrors.name)}
            aria-describedby={lang === "uz" ? described("name") : undefined}
          />
          {lang === "uz" && err("name")}
        </div>

        <div>
          <label htmlFor={`${uid}-desc`} className="field-label">
            Tavsifi
          </label>
          <textarea
            id={`${uid}-desc`}
            rows={4}
            className="field-input resize-y"
            value={description[lang]}
            maxLength={3000}
            placeholder={lang === "uz" ? "Mahsulot haqida qisqacha: uslub, qachon kiyiladi…" : description.uz}
            onChange={(e) => setDescription({ ...description, [lang]: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor={`${uid}-mat`} className="field-label">
            Material
          </label>
          <input
            id={`${uid}-mat`}
            className="field-input"
            value={material[lang]}
            maxLength={300}
            placeholder={lang === "uz" ? "Masalan: Tabiiy charm (qo‘y terisi)" : material.uz}
            onChange={(e) => setMaterial({ ...material, [lang]: e.target.value })}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-cat`} className="field-label">
              Kategoriya <span className="text-bronze">*</span>
            </label>
            <select
              id={`${uid}-cat`}
              className="field-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-invalid={Boolean(fieldErrors.category)}
              aria-describedby={described("category")}
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            {err("category")}
          </div>
          <div>
            <label htmlFor={`${uid}-sku`} className="field-label">
              Artikul
            </label>
            <input
              id={`${uid}-sku`}
              className="field-input"
              value={sku}
              maxLength={40}
              placeholder="Bo‘sh qolsa avtomatik"
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Narx va o'lcham ── */}
      <section className="card space-y-5 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-brown">Narx va o‘lcham</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-price`} className="field-label">
              Narxi, so‘m <span className="text-bronze">*</span>
            </label>
            <input
              id={`${uid}-price`}
              inputMode="numeric"
              className="field-input tabular-nums"
              value={pretty(price)}
              placeholder="890 000"
              onChange={(e) => setPrice(digits(e.target.value))}
              aria-invalid={Boolean(fieldErrors.price)}
              aria-describedby={described("price")}
            />
            {err("price")}
          </div>
          <div>
            <label htmlFor={`${uid}-old`} className="field-label">
              Eski narxi (chegirma bo‘lsa)
            </label>
            <input
              id={`${uid}-old`}
              inputMode="numeric"
              className="field-input tabular-nums"
              value={pretty(oldPrice)}
              placeholder="—"
              onChange={(e) => setOldPrice(digits(e.target.value))}
              aria-invalid={Boolean(fieldErrors.oldPrice)}
              aria-describedby={described("oldPrice")}
            />
            {err("oldPrice")}
          </div>
        </div>

        <fieldset>
          <legend className="field-label">O‘lchamlar</legend>
          <div className="inline-flex rounded-full border border-line bg-paper p-1">
            {[
              { v: false, t: "O‘lchamsiz" },
              { v: true, t: "O‘lchamlari bor" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                aria-pressed={hasSizes === o.v}
                onClick={() => {
                  setHasSizes(o.v);
                  if (o.v && !sizes.length) setSizes([{ label: "", stock: "1" }]);
                }}
                className={`h-9 rounded-full px-4 text-xs font-semibold transition-colors ${
                  hasSizes === o.v ? "bg-brown text-cream" : "text-muted hover:text-brown"
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>

          {!hasSizes ? (
            <div className="mt-4 max-w-xs">
              <label htmlFor={`${uid}-stock`} className="field-label">
                Qoldiq, dona
              </label>
              <input
                id={`${uid}-stock`}
                inputMode="numeric"
                className="field-input tabular-nums"
                value={stock}
                onChange={(e) => setStock(digits(e.target.value).slice(0, 6))}
              />
              <p className="mt-1 text-xs text-muted">0 bo‘lsa — “vaqtincha yo‘q” deb ko‘rsatiladi.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="self-center text-xs text-muted">Tayyor ro‘yxat:</span>
                {Object.entries(PRESETS).map(([label, list]) => (
                  <button key={label} type="button" className="chip" onClick={() => applyPreset(list)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="grid grid-cols-[1fr_1fr_2.75rem] gap-2 bg-ivory px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <span>O‘lcham</span>
                  <span>Qoldiq</span>
                  <span className="sr-only">Amal</span>
                </div>
                {sizes.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_2.75rem] items-center gap-2 border-t border-line px-3 py-2">
                    <input
                      aria-label={`O‘lcham ${i + 1}`}
                      className="field-input min-h-10 py-2"
                      value={s.label}
                      maxLength={20}
                      placeholder="38"
                      onChange={(e) => setSizes(sizes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    />
                    <input
                      aria-label={`${s.label || `O‘lcham ${i + 1}`} qoldig‘i`}
                      inputMode="numeric"
                      className="field-input min-h-10 py-2 tabular-nums"
                      value={s.stock}
                      onChange={(e) =>
                        setSizes(sizes.map((x, j) => (j === i ? { ...x, stock: digits(e.target.value).slice(0, 6) } : x)))
                      }
                    />
                    <button
                      type="button"
                      aria-label={`${s.label || "O‘lcham"} ni olib tashlash`}
                      className="icon-btn h-10 w-10 text-error"
                      onClick={() => setSizes(sizes.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSizes([...sizes, { label: "", stock: "1" }])}
              >
                + O‘lcham
              </button>
              {err("sizes")}
            </div>
          )}
          <p className="mt-3 text-sm text-muted">
            Jami qoldiq: <b className="tabular-nums text-brown">{totalStock}</b> dona
          </p>
        </fieldset>
      </section>

      {/* ── Ko'rinish ── */}
      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-2xl text-brown">Ko‘rinish</h2>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#261918]" />
          <span>
            <span className="block text-sm font-semibold text-brown">Saytda va Mini App’da ko‘rsatish</span>
            <span className="block text-xs text-muted">O‘chirilsa — mahsulot saqlanadi, lekin mijozlarga ko‘rinmaydi.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#261918]" />
          <span>
            <span className="block text-sm font-semibold text-brown">Bosh sahifada (tanlangan mahsulotlar)</span>
            <span className="block text-xs text-muted">Saytning “Mavsumning eng e’tiborli modellari” bo‘limida chiqadi.</span>
          </span>
        </label>
      </section>

      {error && (
        <p className="alert-error" role="alert">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-cream/95 px-5 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Link href="/admin" className="btn btn-secondary">
          Bekor qilish
        </Link>
        <button type="submit" disabled={busy || processing} aria-busy={busy} className="btn btn-primary">
          {busy && <span className="spinner" aria-hidden />}
          {busy ? "Saqlanmoqda…" : product ? "Saqlash" : "Mahsulotni qo‘shish"}
        </button>
      </div>
    </form>
  );
}
