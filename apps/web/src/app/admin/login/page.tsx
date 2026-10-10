import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { MellaEmblem } from "@/components/Logo";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kirish" };

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  const configured = adminConfigured();
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="card w-full max-w-sm p-8 shadow-card">
        <MellaEmblem className="h-11 w-11" />
        <p className="eyebrow mt-5">MELLA</p>
        <h1 className="mt-2 font-display text-3xl text-brown">Admin panel</h1>
        <p className="mt-1.5 text-sm text-muted">Mahsulotlarni qo‘lda boshqarish (ERP ulanguncha).</p>
        {configured ? (
          <LoginForm />
        ) : (
          <p className="alert-error mt-6" role="alert">
            Railway’da <b>ADMIN_PASSWORD</b> o‘zgaruvchisini qo‘ying, so‘ng sahifani yangilang.
          </p>
        )}
      </div>
    </main>
  );
}
