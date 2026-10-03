import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-slate-600">That page or record doesn&apos;t exist. It may have been deleted.</p>
      <Link href="/" className="inline-block rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white">
        Back to the dashboard
      </Link>
    </div>
  );
}
