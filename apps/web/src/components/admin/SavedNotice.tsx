"use client";

import { useEffect, useState } from "react";

/** Saqlashdan keyingi xabar (?saved=1&mirror=...). Bir marta ko'rsatiladi. */
export function SavedNotice() {
  const [info, setInfo] = useState<{ mirror: string; error: string } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("saved")) return;
    const next = { mirror: q.get("mirror") ?? "", error: q.get("mirrorError") ?? "" };
    window.history.replaceState(null, "", "/admin");
    // URL'dan o'qilgan bir martalik xabar — effekt ichida o'rnatish shu yerda kerak.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInfo(next);
  }, []);
  if (!info) return null;
  const warn = info.mirror === "false";
  return (
    <div
      role="status"
      className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
        warn ? "border-error/25 bg-error/[0.07] text-error" : "border-success/25 bg-success/10 text-success"
      }`}
    >
      {warn
        ? `Saytga saqlandi, lekin Mini App bazasiga yozilmadi: ${info.error}. “Mini App bilan sinxronlash” tugmasini bosing.`
        : info.mirror === "true"
          ? "Saqlandi — saytda va Mini App’da ko‘rinadi (Mini App ~30 soniyada yangilanadi)."
          : "Saytga saqlandi. Mini App’da ham chiqishi uchun BOT_DATABASE_URL qo‘ying."}
    </div>
  );
}
