"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      Chiqish
    </button>
  );
}
