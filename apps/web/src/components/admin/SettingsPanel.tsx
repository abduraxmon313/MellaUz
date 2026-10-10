"use client";

import { useState } from "react";

/** Namuna (demo) mahsulotlarni yashirish va bot bazasini sinxronlash. */
export function SettingsPanel({ hideSamples, mirror }: { hideSamples: boolean; mirror: boolean }) {
  const [hide, setHide] = useState(hideSamples);
  const [busy, setBusy] = useState<"" | "hide" | "sync">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; mirrored?: boolean | null; mirrorError?: string };
    if (!res.ok || !data.ok) throw new Error(data.error || "Xato");
    return data;
  }

  async function toggle(next: boolean) {
    setBusy("hide");
    setMsg(null);
    setHide(next); // darhol ko'rsatamiz, xato bo'lsa qaytaramiz
    try {
      const r = await call("/api/admin/settings", { hideSamples: next });
      setMsg({
        ok: r.mirrored !== false,
        text: r.mirrored === false ? `Saytda saqlandi, Mini App bazasiga yozilmadi: ${r.mirrorError}` : "Saqlandi",
      });
    } catch (err) {
      setHide(!next);
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy("");
    }
  }

  async function sync() {
    setBusy("sync");
    setMsg(null);
    try {
      const r = await call("/api/admin/sync", {});
      setMsg({
        ok: r.mirrored === true,
        text: r.mirrored ? "Mini App bazasi sayt bilan tenglashtirildi" : `Sinxronlanmadi: ${r.mirrorError ?? "BOT_DATABASE_URL yo‘q"}`,
      });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="card mt-8 grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center" aria-label="Sozlamalar">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={hide}
          disabled={busy !== ""}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#261918]"
        />
        <span>
          <span className="block text-sm font-semibold text-brown">Namuna (demo) mahsulotlarni yashirish</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            Yoqilsa, saytda va Mini App’da faqat siz qo‘shgan mahsulotlar ko‘rinadi.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <span className={`badge ${mirror ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
          {mirror ? "Mini App bazasi ulangan" : "BOT_DATABASE_URL yo‘q"}
        </span>
        {mirror && (
          <button type="button" disabled={busy !== ""} onClick={sync} className="btn btn-secondary btn-sm">
            {busy === "sync" && <span className="spinner" aria-hidden />}
            Mini App bilan sinxronlash
          </button>
        )}
      </div>
      {msg && (
        <p
          role="status"
          className={`text-sm sm:col-span-2 ${msg.ok ? "text-success" : "text-error"}`}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}
