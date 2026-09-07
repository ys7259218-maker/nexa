import type { Metadata } from "next";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { maskWhatsAppId } from "@/lib/conversations";
import {
  listOptedOutCustomers,
  optOutSourceLabel,
  type OptedOutCustomer,
} from "@/lib/optedOutCustomers";

export const metadata: Metadata = { title: "Opted-out customers | Nexa AI" };

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function OptOutRow({ customer }: { customer: OptedOutCustomer }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 py-4 last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/conversations?conversation=${customer.id}`}
            className="font-medium text-zinc-200 hover:text-cyan-300"
          >
            {maskWhatsAppId(customer.customer_wa_id)}
          </Link>
          <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
            Opted out
          </span>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
            {optOutSourceLabel(customer.customer_opt_out_source)}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Opted out {formatDate(customer.customer_opted_out_at)} · last message{" "}
          {formatDate(customer.last_message_at)}
        </p>
      </div>
    </div>
  );
}

export default async function OptedOutCustomersPage() {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <AppLayout>
        <p className="text-sm text-rose-300">Unable to connect to the message store.</p>
      </AppLayout>
    );
  }

  const result = await listOptedOutCustomers(supabase);
  const customers = result.error ? null : result.data;
  const loadError = result.error;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Contacts</p>
          <h1 className="mt-2 text-4xl font-bold">Opted-out customers</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Customers who have opted out of WhatsApp messaging. Opt-outs are honored — this list is read-only and cannot be cleared.
          </p>
        </div>

        {loadError ? (
          <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{loadError}</p>
        ) : null}

        {customers ? (
          <Card className="space-y-1">
            {customers.customers.length === 0 ? (
              <p className="py-6 text-sm text-zinc-500">
                No customers have opted out. Opt-out requests recorded here the moment a customer sends a stop keyword.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                  <p className="text-xs text-zinc-500">
                    {customers.total} opted {customers.total === 1 ? "customer" : "customers"}
                    {customers.truncated
                      ? ` · showing the newest ${customers.customers.length}`
                      : ""}
                  </p>
                </div>
                {customers.customers.map((customer) => (
                  <OptOutRow key={customer.id} customer={customer} />
                ))}
              </>
            )}
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}