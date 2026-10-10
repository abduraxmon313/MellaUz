import Link from "next/link";
import { MellaEmblem } from "@/components/Logo";
import { LogoutButton } from "./LogoutButton";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
          <Link href="/admin" className="flex items-end gap-1.5 rounded-md">
            <MellaEmblem className="h-8 w-8" />
            <span className="font-display text-2xl leading-none text-brown">Mella</span>
            <span className="mb-0.5 ml-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-bronze">admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener" className="btn btn-secondary btn-sm hidden sm:inline-flex">
              Saytni ochish
            </a>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-10">{children}</main>
    </>
  );
}
