import Link from "next/link";
import type { ReactNode } from "react";

export type Crumb = { href?: string; label: string };

/** Ichki sahifalar uchun yagona sarlavha bloki (ivory yuza, nozik chegara). */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  crumbs,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-line bg-ivory pt-[calc(var(--header-h)+2.5rem)] pb-10 lg:pt-[calc(var(--header-h)+4rem)] lg:pb-14">
      <div className="container-site">
        {crumbs && crumbs.length > 0 && <Breadcrumbs items={crumbs} />}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className={`h-page text-brown ${eyebrow ? "mt-3" : ""}`}>{title}</h1>
        {subtitle && <p className="lead mt-3 max-w-2xl">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}

export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`mb-5 ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2">
              {item.href && !last ? (
                <Link href={item.href} className="rounded-sm transition-colors hover:text-brown">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="text-brown">
                  {item.label}
                </span>
              )}
              {!last && (
                <span aria-hidden className="text-line-strong">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
