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
      <div className="rounded-2xl border border-line bg-paper p-8 text-center" role="status" aria-live="polite">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success ring-1 ring-success/25">
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
        <h3 className="font-display text-2xl text-brown">{t.successTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t.successText}</p>
        {onDone && (
          <button type="button" onClick={onDone} className="btn btn-primary mt-6">
            {t.close}
          </button>
        )}
      </div>
    );
  }

  const field = "field-input";
  const label = "field-label";
  const errorIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5v5.5M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-name`} className={label}>
            {t.name} <span className="text-bronze" aria-hidden>*</span>
          </label>
          <input
            id={`${uid}-name`}
            name="name"
            type="text"
            autoComplete="name"
            placeholder={t.namePlaceholder}
            className={field}
            required
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${uid}-name-err` : undefined}
          />
          {errors.name && (
            <p id={`${uid}-name-err`} className="field-error">
              {errorIcon}
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${uid}-phone`} className={label}>
            {t.phone} <span className="text-bronze" aria-hidden>*</span>
          </label>
          <input
            id={`${uid}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t.phonePlaceholder}
            className={field}
            required
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? `${uid}-phone-err` : undefined}
          />
          {errors.phone && (
            <p id={`${uid}-phone-err`} className="field-error">
              {errorIcon}
              {errors.phone}
            </p>
          )}
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
        <p className="alert-error" role="alert">
          {errorIcon}
          {t.errorGeneric}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        aria-busy={status === "submitting"}
        className="btn btn-primary btn-lg btn-block"
      >
        {status === "submitting" && <span className="spinner" aria-hidden />}
        {status === "submitting" ? t.submitting : t.submit}
      </button>

      <p className="text-xs leading-relaxed text-muted">{t.privacy}</p>
    </form>
  );
}
