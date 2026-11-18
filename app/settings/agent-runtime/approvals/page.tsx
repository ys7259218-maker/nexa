import type { Metadata } from "next";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { projectB9ApprovalQueue } from "@/lib/agent/b9Console";
import {
  agentRuntimeGateLabel,
  inspectAgentRuntimeGate,
} from "@/lib/agent/gate";
import { listVisibleAgentTasks } from "@/lib/agent/queries";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agent approvals | Nexa AI" };

function statusCard(title: string, lines: readonly string[]) {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Settings / Agent runtime
          </p>
          <h1 className="mt-2 text-4xl font-bold">In-flight approvals</h1>
        </div>
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          {lines.map((line) => (
            <p key={line} className="text-zinc-400">
              {line}
            </p>
          ))}
          <Link
            href="/settings/agent-runtime"
            className="inline-block pt-2 text-sm text-cyan-300 hover:underline"
          >
            Back to agent runtime
          </Link>
        </Card>
      </div>
    </AppLayout>
  );
}

export default async function AgentApprovalsPage() {
  await requireAuthenticatedUser();

  // Same kill switch as the task console: off or production means zero reads.
  const gate = inspectAgentRuntimeGate(process.env);
  if (!gate.enabled) {
    return statusCard("Agent runtime is disabled", [
      `${agentRuntimeGateLabel(gate)}. Approval state stays dormant until an operator explicitly enables the non-production flag.`,
      "No workspace query ran while this view shows the disabled state.",
    ]);
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return statusCard("Agent runtime unavailable", [
      "The workspace data connection is not configured.",
    ]);
  }

  const queue = projectB9ApprovalQueue(await listVisibleAgentTasks(client, 50));

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Settings / Agent runtime
          </p>
          <h1 className="mt-2 text-4xl font-bold">In-flight approvals</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Read-only queue of tasks awaiting approval in this workspace. No
            task text is shown; approve, deny and retry stay in the existing
            gated runtime, not in this view.
          </p>
        </div>

        <Card className="space-y-1">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xl font-semibold">Awaiting approval</h2>
            <span className="text-xs text-zinc-500">{queue.total} shown</span>
          </div>

          {queue.rows.length === 0 ? (
            <p className="py-3 text-sm text-zinc-400">
              No tasks are awaiting approval in this workspace.
            </p>
          ) : (
            queue.rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 py-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-200">{row.state}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Created {new Date(row.createdAt).toLocaleString()} · Deadline{" "}
                    {new Date(row.deadlineAt).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/settings/agent-runtime/${row.id}`}
                  className="text-sm text-cyan-300 hover:underline"
                >
                  View status
                </Link>
              </div>
            ))
          )}

          <p className="pt-3 text-xs text-zinc-600">
            Read-only. This view has no approve or deny control; state changes
            are written only by the gated runtime and its reviewed functions.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}
