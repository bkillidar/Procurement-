import Link from "next/link";
import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pt-3">
        <Link href="/" className="mb-2 block font-semibold">
          Development Ops
        </Link>
        <Nav />
      </header>
      <main className="mx-auto max-w-5xl p-4 pb-16">{children}</main>
    </div>
  );
}
