import type { Metadata } from "next";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { projectB9TaskDetail, type B9SafeCounts } from "@/lib/agent/b9Console";
import {
  agentRuntimeGateLabel,
  inspectAgentRuntimeGate,
} from "@/lib/agent/gate";
import {
  getVisibleAgentTask,
  isAgentTaskId,
  listVisibleAgentEvents,
} from "@/lib/agent/queries";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agent task detail | Nexa AI" };

function statusCard(title: string, lines: readonly string[]) {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Settings / Agent runtime
          </p>
          <h1 className="mt-2 text-4xl font-bold">Task detail</h1>
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

function EventTypeCounts({ counts }: { counts: B9SafeCounts }) {
  const entries = Object.entries(counts).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">No recorded events.</p>;
  }
  return (
    <ul className="space-y-1">
      {entries.map(([type, count]) => (
        <li key={type} className="flex justify-between text-sm text-zinc-400">
          <span>{type}</span>
          <span>{count}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AgentTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthenticatedUser();

  // Gate first: while the flag is off or in production, no task id is read and
  // no workspace query runs. This mirrors the B1 console and B8 observability.
  const gate = inspectAgentRuntimeGate(process.env);
  if (!gate.enabled) {
    return statusCard("Agent runtime is disabled", [
      `${agentRuntimeGateLabel(gate)}. Task details stay dormant until an operator explicitly enables the non-production flag.`,
      "No task was read and no event stream was opened while this view shows the disabled state.",
    ]);
  }

  const { id } = await params;
  if (!isAgentTaskId(id)) {
    return statusCard("Task unavailable", [
      "This task id is not a valid agent task identifier. No workspace data was read.",
    ]);
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return statusCard("Agent runtime unavailable", [
      "The workspace data connection is not configured.",
    ]);
  }

  // Both reads are RLS-scoped by the caller's Supabase session. A foreign
  // workspace id yields null/empty and is rendered as "not found", never as a
  // cross-workspace existence signal.
  const task = await getVisibleAgentTask(client, id);
  const events = task === null ? [] : await listVisibleAgentEvents(client, id, 0);
  const detail = projectB9TaskDetail(task, events);
  if (detail === null) {
    return statusCard("Task not found", [
      "No task with this id is visible in the current workspace.",
    ]);
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Settings / Agent runtime
          </p>
          <h1 className="mt-2 text-4xl font-bold">Task detail</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Content-free status view. Task text, event payloads and evidence are
            never rendered here — only lifecycle state and bounded counters.
          </p>
        </div>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Lifecycle</h2>
            <code className="text-[11px] text-zinc-600">{detail.id}</code>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">State</dt>
              <dd className="text-zinc-200">{detail.state}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Error class
              </dt>
              <dd className="text-zinc-200">{detail.errorClass ?? "none"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Created
              </dt>
              <dd className="text-zinc-200">
                {new Date(detail.createdAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Deadline
              </dt>
              <dd className="text-zinc-200">
                {new Date(detail.deadlineAt).toLocaleString()}
              </dd>
            </div>
          </dl>
          {detail.cancelRequested ? (
            <p className="text-sm text-amber-300">Cancellation requested.</p>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Events</h2>
            <span className="text-xs text-zinc-500">
              {detail.eventCount} recorded
            </span>
          </div>
          <EventTypeCounts counts={detail.eventTypes} />
          <p className="pt-2 text-xs text-zinc-600">
            Only event-type counters are shown. Payloads are never displayed.
          </p>
        </Card>

        <Link
          href="/settings/agent-runtime"
          className="inline-block text-sm text-cyan-300 hover:underline"
        >
          Back to agent runtime
        </Link>
      </div>
    </AppLayout>
  );
}
