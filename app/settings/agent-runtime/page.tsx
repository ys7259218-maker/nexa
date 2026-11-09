import type { Metadata } from "next";
import AppLayout from "@/components/layout/AppLayout";
import Card from "@/components/ui/Card";
import { agentRuntimeGateLabel, inspectAgentRuntimeGate } from "@/lib/agent/gate";
import { listVisibleAgentTasks } from "@/lib/agent/queries";
import type { AgentTaskSummary } from "@/lib/agent/types";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agent runtime | Nexa AI" };

const STATE_CHIP: Record<AgentTaskSummary["state"], string> = {
  INTAKE: "bg-zinc-700/40 text-zinc-300",
  CLARIFY: "bg-amber-500/10 text-amber-300",
  PLANNING: "bg-violet-500/10 text-violet-300",
  AWAITING_APPROVAL: "bg-amber-500/10 text-amber-300",
  EXECUTING: "bg-cyan-500/10 text-cyan-300",
  VERIFYING: "bg-sky-500/10 text-sky-300",
  NEEDS_USER_INPUT: "bg-orange-500/10 text-orange-300",
  COMPLETE: "bg-emerald-500/10 text-emerald-300",
  FAILED: "bg-red-500/10 text-red-300",
  CANCELLED: "bg-zinc-700/40 text-zinc-400",
};

function stateLabel(state: AgentTaskSummary["state"]): string {
  return state.replace(/_/g, " ").toLowerCase();
}

function TaskRow({ task }: { task: AgentTaskSummary }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 py-3 last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATE_CHIP[task.state]}`}
          >
            {stateLabel(task.state)}
          </span>
          {task.cancelRequested ? (
            <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              Cancel requested
            </span>
          ) : null}
        </div>
        <p className="mt-1 break-words font-medium text-zinc-200">{task.goal}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Created {new Date(task.createdAt).toLocaleString()} · Deadline{" "}
          {new Date(task.deadlineAt).toLocaleString()}
        </p>
        {task.failureReason ? (
          <p className="mt-1 text-xs text-red-300">Failure: {task.failureReason}</p>
        ) : null}
      </div>
      <code className="shrink-0 text-[11px] text-zinc-600">{task.id}</code>
    </div>
  );
}

export default async function AgentRuntimePage() {
  await requireAuthenticatedUser();
  const gate = inspectAgentRuntimeGate(process.env);

  if (!gate.enabled) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Settings
            </p>
            <h1 className="mt-2 text-4xl font-bold">Agent runtime</h1>
          </div>
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold">Agent runtime is disabled</h2>
            <p className="text-zinc-400">
              {agentRuntimeGateLabel(gate)}. The durable task tables, lease RPCs,
              and event stream stay dormant until an operator explicitly enables
              the non-production flag.
            </p>
            <p className="text-xs text-zinc-600">
              No task can be created, claimed, or executed while this view shows
              the disabled state.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Settings
            </p>
            <h1 className="mt-2 text-4xl font-bold">Agent runtime</h1>
          </div>
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-red-300">
              Agent runtime unavailable
            </h2>
            <p className="text-zinc-400">
              The workspace data connection is not configured.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const tasks = await listVisibleAgentTasks(client, 50);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Settings
          </p>
          <h1 className="mt-2 text-4xl font-bold">Agent runtime</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Read-only view of durable agent sessions and tasks for this workspace.
            B1 executes deterministic mock steps only; no provider, messaging,
            calendar, or browser action exists in this runtime.
          </p>
        </div>

        <Card className="space-y-1">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xl font-semibold">Recent tasks</h2>
            <span className="text-xs text-zinc-500">{tasks.length} shown</span>
          </div>

          {tasks.length === 0 ? (
            <div className="space-y-2 py-3">
              <p className="font-medium text-zinc-200">No agent tasks yet</p>
              <p className="text-sm text-zinc-400">
                When a task is created through a future authorized surface it will
                appear here with its state, deadline, and failure reason.
              </p>
            </div>
          ) : (
            tasks.map((task) => <TaskRow key={task.id} task={task} />)
          )}

          <p className="pt-3 text-xs text-zinc-600">
            Read-only. This console has no create, cancel, approve, retry, or
            execution controls; task state is written only by the gated runtime
            and its reviewed database functions.
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}
