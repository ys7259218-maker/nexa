import Link from "next/link";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-12 text-zinc-200">
      <article className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-2xl sm:p-10">
        <Link href="/" className="text-sm font-semibold text-cyan-400 hover:text-cyan-300">
          ← Nexa AI
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-zinc-400">Last updated: {updated}</p>
        <div className="mt-8 space-y-7 leading-7 text-zinc-300 [&_a]:text-cyan-400 [&_a]:underline [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          {children}
        </div>
        <nav aria-label="Legal pages" className="mt-10 flex flex-wrap gap-4 border-t border-white/10 pt-6 text-sm">
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data-deletion">Data Deletion</Link>
        </nav>
      </article>
    </main>
  );
}
