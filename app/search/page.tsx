import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { sanitizeLikeTerm, searchWorkspace, type SearchResultGroup } from "@/lib/search";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export const metadata: Metadata = { title: "Search | Nexa AI" };

function readQuery(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  await requireAuthenticatedUser();

  const query = readQuery((await searchParams).q).trim();
  const activeQuery = sanitizeLikeTerm(query);

  const supabase = await createSupabaseServerClient();

  let error: string | null = null;
  let groups: SearchResultGroup[] = [];

  if (activeQuery.length > 0) {
    if (!supabase) {
      error =
        "Search is unavailable because Supabase is not configured. Add the variables from .env.example and reload.";
    } else {
      const result = await searchWorkspace(supabase, query);
      if (result.error) {
        error = result.error;
      } else if (result.data) {
        groups = result.data.groups;
      }
    }
  }

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <AppLayout>
      <div className="space-y-7">
        <div>
          <h1 className="text-4xl font-bold">Search</h1>
          <p className="mt-2 text-zinc-400">
            Find AI employees, conversations and messages, call records, and appointments.
          </p>
        </div>

        <Card>
          <form
            role="search"
            aria-label="Search Nexa workspace"
            action="/search"
            method="get"
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">
              <Search size={18} className="shrink-0 text-zinc-500" aria-hidden="true" />
              <input
                name="q"
                autoComplete="off"
                enterKeyHint="search"
                defaultValue={query}
                aria-label="Search query"
                placeholder="Try a name, WhatsApp ID, or keyword"
                className="w-full bg-transparent text-white outline-none placeholder:text-zinc-500"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-black transition hover:bg-cyan-400"
            >
              Search
            </button>
          </form>
        </Card>

        {query && activeQuery.length === 0 ? (
          <Card className="space-y-2">
            <h2 className="text-xl font-semibold">That query has no usable text</h2>
            <p className="text-zinc-400">Remove the symbols and try plain words or numbers.</p>
          </Card>
        ) : null}

        {error ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-red-400">Could not search your workspace</h2>
            <p className="text-zinc-400">{error}</p>
          </Card>
        ) : null}

        {activeQuery.length > 0 && !error ? (
          total === 0 ? (
            <Card className="space-y-2">
              <h2 className="text-xl font-semibold">No results for “{query}”</h2>
              <p className="text-zinc-400">
                Nothing in your workspace matched. Try a different name or keyword.
              </p>
            </Card>
          ) : (
            groups.map((group) => (
              <Card key={group.id} className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold">{group.label}</h2>
                  <span className="text-sm text-zinc-500">
                    {group.items.length} {group.items.length === 1 ? "match" : "matches"}
                  </span>
                </div>

                <ul className="divide-y divide-zinc-800">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="block rounded-xl px-3 py-3 transition hover:bg-white/5"
                      >
                        <span className="font-medium text-white">{item.title}</span>
                        <span className="mt-0.5 block text-sm text-zinc-500">{item.subtitle}</span>
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="pt-1">
                  <Link
                    href={group.allHref}
                    className="text-sm font-semibold text-cyan-400 transition hover:text-cyan-300"
                  >
                    View all in {group.label} →
                  </Link>
                </div>
              </Card>
            ))
          )
        ) : null}

        {activeQuery.length === 0 ? (
          <Card className="space-y-2">
            <h2 className="text-xl font-semibold">What can I search?</h2>
            <p className="text-zinc-400">
              Your AI employee names and departments, business names, WhatsApp contacts and
              message text, call-record customers, and appointment customers, services, or
              locations. Results respect the exact stored data.
            </p>
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}