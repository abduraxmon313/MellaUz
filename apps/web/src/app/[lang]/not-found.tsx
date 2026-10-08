import Link from "next/link";
import { ArrowIcon } from "@/components/ArrowIcon";

export default function NotFound() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-5 pt-20 text-center">
      <div>
        <p className="font-display text-7xl text-gold/30">404</p>
        <h1 className="mt-4 font-display text-3xl text-pearl">Sahifa topilmadi</h1>
        <p className="mx-auto mt-3 max-w-md text-pearl/60">
          Siz izlagan sahifa mavjud emas yoki ko‘chirilgan. · The page you are
          looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3 text-sm font-semibold uppercase tracking-wider text-espresso transition hover:bg-champagne"
        >
          MELLA
            <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}
