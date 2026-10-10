"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Ikki bosqichli o'chirish: avval tasdiqlash so'raladi. */
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "O‘chirib bo‘lmadi");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="btn btn-secondary btn-sm text-error" onClick={() => setConfirming(true)}>
        O‘chirish
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2" role="group" aria-label={`“${name}” o‘chirilsinmi?`}>
      <span className="text-xs font-medium text-error">O‘chirilsinmi?</span>
      <button type="button" disabled={busy} className="btn btn-sm bg-error text-cream hover:opacity-90" onClick={remove}>
        {busy && <span className="spinner" aria-hidden />}
        Ha
      </button>
      <button type="button" disabled={busy} className="btn btn-secondary btn-sm" onClick={() => setConfirming(false)}>
        Yo‘q
      </button>
      {error && (
        <span className="w-full text-xs text-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
