import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found | Nexa AI",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        404
      </p>

      <h1 className="mt-3 text-4xl font-bold">
        This page could not be found
      </h1>

      <p className="mt-3 max-w-md text-zinc-400">
        The link may be broken, or the page may have moved.
      </p>

      <Link
        href="/"
        className="mt-8 rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-black transition hover:bg-cyan-400"
      >
        Back to Nexa
      </Link>
    </main>
  );
}