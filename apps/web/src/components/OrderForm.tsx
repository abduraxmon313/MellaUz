"use client";

import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type Status = "idle" | "submitting" | "success" | "error";

export function OrderForm({
  dict,
  locale,
  defaultProduct = "",
  onSuccess,
  onDone,
}: {
  dict: Dictionary;
  locale: Locale;
  defaultProduct?: string;
  onSuccess?: () => void;
  /** Dialog ichida ishlatilganda — muvaffaqiyatdan keyin "Yopish" tugmasi. */
  onDone?: () => void;
}) {
  const t = dict.order;
  const uid = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();

    const nextErrors: { name?: string; phone?: string } = {};
    if (name.length < 2) nextErrors.name = t.errorName;
    if (!/^[+()\d][\d\s()-]{6,24}$/.test(phone)) nextErrors.phone = t.errorPhone;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("submitting");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          product: String(data.get("product") ?? ""),
          note: String(data.get("note") ?? ""),
          company: String(data.get("company") ?? ""),
          locale,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("success");
      form.reset();
      onSuccess?.();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-gold/30 bg-dark-chocolate/60 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 text-gold">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 6 9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="font-display text-2xl text-champagne">{t.successTitle}</h3>
        <p className="mt-2 text-sm text-pearl/70">{t.successText}</p>
        {onDone && (
          <button type="button" onClick={onDone} className="btn-gold mt-6">
            {t.close}
          </button>
        )}
      </div>
    );
  }

  const field =
    "w-full rounded-2xl border border-pearl/10 bg-espresso/50 px-4 py-3.5 text-[15px] text-pearl placeholder:text-pearl/30 outline-none transition focus:border-gold/60 focus:bg-espresso/70 focus:ring-4 focus:ring-gold/10 aria-[invalid=true]:border-gold/70";
  const label = "mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-pearl/55";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-name`} className={label}>
            {t.name} *
          </label>
          <input
            id={`${uid}-name`}
            name="name"
            type="text"
            autoComplete="name"
            placeholder={t.namePlaceholder}
            className={field}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="mt-1 text-xs text-gold">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className={label}>
            {t.phone} *
          </label>
          <input
            id={`${uid}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t.phonePlaceholder}
            className={field}
            aria-invalid={Boolean(errors.phone)}
          />
          {errors.phone && <p className="mt-1 text-xs text-gold">{errors.phone}</p>}
        </div>
      </div>

      <div>
        <label htmlFor={`${uid}-product`} className={label}>
          {t.product}
        </label>
        <input
          id={`${uid}-product`}
          name="product"
          type="text"
          defaultValue={defaultProduct}
          placeholder={t.productPlaceholder}
          className={field}
        />
      </div>

      <div>
        <label htmlFor={`${uid}-note`} className={label}>
          {t.note}
        </label>
        <textarea
          id={`${uid}-note`}
          name="note"
          rows={3}
          placeholder={t.notePlaceholder}
          className={`${field} resize-none`}
        />
      </div>

      {/* Honeypot — ko'rinmaydi, odam to'ldirmaydi */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input name="company" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {status === "error" && (
        <p className="text-sm text-gold">{t.errorGeneric}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn-gold w-full disabled:pointer-events-none disabled:opacity-60"
      >
        {status === "submitting" && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-espresso/30 border-t-espresso" aria-hidden />
        )}
        {status === "submitting" ? t.submitting : t.submit}
      </button>

      <p className="text-xs text-pearl/45">{t.privacy}</p>
    </form>
  );
}
