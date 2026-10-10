"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || "Kirib bo‘lmadi");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <div>
        <label htmlFor="admin-password" className="field-label">
          Parol
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="field-input"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "admin-login-err" : undefined}
        />
      </div>
      {error && (
        <p id="admin-login-err" className="alert-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} aria-busy={busy} className="btn btn-primary btn-block">
        {busy && <span className="spinner" aria-hidden />}
        Kirish
      </button>
    </form>
  );
}
