"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { OrderForm } from "./OrderForm";
import { MellaEmblem } from "./Logo";

type Variant = "solid" | "outline" | "link";

const variants: Record<Variant, string> = {
  solid: "btn-gold",
  outline: "btn-ghost",
  link: "inline-flex items-center gap-1 text-sm font-medium uppercase tracking-wider text-gold transition hover:text-champagne",
};

/** Bir nechta dialog/menyu bir vaqtda ochilsa ham skroll to'g'ri tiklanishi uchun. */
let lockCount = 0;
let savedScrollY = 0;
function lockScroll() {
  if (lockCount++ > 0) return;
  savedScrollY = window.scrollY;
  const gap = window.innerWidth - document.documentElement.clientWidth;
  const s = document.body.style;
  s.position = "fixed";
  s.top = `-${savedScrollY}px`;
  s.left = "0";
  s.right = "0";
  s.width = "100%";
  s.paddingRight = gap > 0 ? `${gap}px` : "";
}
function unlockScroll() {
  if (--lockCount > 0) return;
  lockCount = 0;
  const s = document.body.style;
  s.position = s.top = s.left = s.right = s.width = s.paddingRight = "";
  window.scrollTo(0, savedScrollY);
}

export function OrderDialog({
  dict,
  locale,
  label,
  product,
  variant = "solid",
  className = "",
  onOpen,
}: {
  dict: Dictionary;
  locale: Locale;
  label: string;
  product?: string;
  variant?: Variant;
  className?: string;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      triggerRef.current?.focus({ preventScroll: true });
    }, 220);
  }, []);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      // Fokusni dialog ichida ushlab turish
      if (e.key === "Tab" && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        const list = Array.from(items).filter((el) => !el.hasAttribute("disabled"));
        if (list.length === 0) return;
        const first = list[0]!;
        const last = list[list.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>("input[name='name']")?.focus({ preventScroll: true });
    }, 60);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [open, close]);

  const dialog = (
    <div
      className={`fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-6 ${
        closing ? "dialog-out" : "dialog-in"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={dict.order.title}
    >
      {/* Fon — bosilsa yopiladi */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={close}
        className="dialog-backdrop absolute inset-0 cursor-default bg-espresso/75 backdrop-blur-md"
      />

      <div
        ref={panelRef}
        className="dialog-panel relative flex max-h-[min(92dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-gold/15 bg-dark-chocolate shadow-luxe sm:rounded-[28px]"
      >
        {/* Mobil "tortish" chizig'i */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-pearl/15 sm:hidden" />

        <div className="relative shrink-0 overflow-hidden px-6 pt-5 pb-5 sm:px-8 sm:pt-8">
          <MellaEmblem className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 opacity-[0.07]" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold/80">MELLA</p>
              <h2 className="mt-1.5 font-display text-3xl text-champagne">{dict.order.title}</h2>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-pearl/60">
                {dict.order.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={dict.nav.closeMenu}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-pearl/10 bg-espresso/40 text-pearl/70 transition hover:rotate-90 hover:border-gold/60 hover:text-champagne"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overscroll-contain overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-8">
          <OrderForm dict={dict} locale={locale} defaultProduct={product} onDone={close} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
        className={`${variants[variant]} ${className}`}
        aria-haspopup="dialog"
      >
        {label}
      </button>
      {/* Portal: dialog body'ga chiqariladi — ota elementlardagi transform/backdrop-filter
          "position: fixed"ni buzmaydi (aks holda oyna tepaga yopishib qolardi). */}
      {open && typeof document !== "undefined" && createPortal(dialog, document.body)}
    </>
  );
}
