"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Skrollda nozik paydo bo'lish effekti (IntersectionObserver). */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // @ts-expect-error — ref turi Tag bo'yicha o'zgaradi, lekin xavfsiz
      ref={ref}
      data-reveal
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(26px)",
        transition: `opacity .8s ease ${delay}ms, transform .8s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </Tag>
  );
}
