"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { OrderForm } from "./OrderForm";

type Variant = "solid" | "outline" | "link";

const variants: Record<Variant, string> = {
  solid:
    "inline-flex items-center justify-center gap-2 rounded-full bg-gold px-7 py-3 text-sm font-semibold uppercase tracking-wider text-espresso transition hover:bg-champagne",
  outline:
    "inline-flex items-center justify-center gap-2 rounded-full border border-pearl/30 px-7 py-3 text-sm font-semibold uppercase tracking-wider text-pearl transition hover:border-gold hover:text-champagne",
  link: "inline-flex items-center gap-1 text-sm font-medium uppercase tracking-wider text-gold transition hover:text-champagne",
};

export function OrderDialog({
  dict,
  locale,
  label,
  product,
  variant = "solid",
  className = "",
}: {
  dict: Dictionary;
  locale: Locale;
  label: string;
  product?: string;
  variant?: Variant;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${variants[variant]} ${className}`}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-espresso/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(e) => {
            if (e.target === ref.current) setOpen(false);
          }}
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={dict.order.title}
        >
          <div className="animate-fade-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-mocha/40 bg-dark-chocolate p-6 shadow-luxe sm:rounded-3xl sm:p-8">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-champagne">
                  {dict.order.title}
                </h2>
                <p className="mt-1 text-sm text-pearl/60">{dict.order.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={dict.nav.closeMenu}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-mocha/50 text-pearl/70 transition hover:border-gold hover:text-champagne"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <OrderForm
              dict={dict}
              locale={locale}
              defaultProduct={product}
            />
          </div>
        </div>
      )}
    </>
  );
}
