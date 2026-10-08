/**
 * Root layout — Next.js App Router buning mavjudligini talab qiladi.
 * Haqiqiy <html>/<body> teglari [lang]/layout.tsx ichida yasaladi;
 * bu faqat passthrough wrapper sifatida ishlaydi.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
