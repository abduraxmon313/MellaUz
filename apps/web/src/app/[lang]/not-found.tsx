import Link from "next/link";
import { ArrowIcon } from "@/components/ArrowIcon";
import { MellaEmblem } from "@/components/Logo";

export default function NotFound() {
  return (
    <section className="flex min-h-[75vh] items-center justify-center px-5 pt-[var(--header-h)] text-center">
      <div className="card max-w-lg px-8 py-12 sm:px-12">
        <MellaEmblem className="mx-auto h-12 w-12" />
        <p className="mt-5 font-display text-6xl leading-none text-bronze">404</p>
        <h1 className="mt-4 font-display text-3xl text-brown">Sahifa topilmadi</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Siz izlagan sahifa mavjud emas yoki ko‘chirilgan. · The page you are
          looking for does not exist.
        </p>
        <Link href="/" className="btn btn-primary mt-8">
          MELLA
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}
