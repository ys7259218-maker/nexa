"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  restoreEmployeeVersionAction,
  type EmployeeVersionActionState,
} from "@/app/ai-employees/[id]/versions/actions";
import Card from "@/components/ui/Card";
import {
  employeeVersionSourceLabel,
  type EmployeeVersion,
} from "@/lib/employeeVersions";

function RestoreButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Restoring…" : "Restore this version"}
    </button>
  );
}

function formatUtc(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

export default function EmployeeVersionHistory({
  employeeId,
  versions,
}: {
  employeeId: string;
  versions: EmployeeVersion[];
}) {
  const initialState: EmployeeVersionActionState = {
    status: "idle",
    error: null,
    restoredVersionId: null,
  };
  const [state, action] = useActionState(restoreEmployeeVersionAction, initialState);

  if (versions.length === 0) {
    return (
      <Card className="space-y-3">
        <h2 className="text-xl font-semibold">No versions yet</h2>
        <p className="text-zinc-400">
          The first baseline appears after the version-history migration is applied. Later settings
          changes are captured automatically.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {state.status === "error" && state.error ? (
        <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-red-200">
          {state.error}
        </div>
      ) : null}

      {state.status === "success" ? (
        <div role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-emerald-200">
          Version restored. The settings page now shows the restored values, and the previous state
          remains available here.
        </div>
      ) : null}

      {versions.map((version) => (
        <Card key={version.id} className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-zinc-100">
                {employeeVersionSourceLabel(version.change_source)}
              </p>
              <time dateTime={version.created_at} className="mt-1 block text-sm text-zinc-500">
                {formatUtc(version.created_at)}
              </time>
            </div>
            {state.restoredVersionId === version.id ? (
              <span className="rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-xs font-semibold text-emerald-200">
                Restored
              </span>
            ) : null}
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
              <dt className="text-zinc-500">Employee name</dt>
              <dd className="mt-1 break-words text-zinc-100">{version.snapshot.name || "Empty"}</dd>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
              <dt className="text-zinc-500">Business</dt>
              <dd className="mt-1 break-words text-zinc-100">{version.snapshot.business_name || "Empty"}</dd>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
              <dt className="text-zinc-500">Department</dt>
              <dd className="mt-1 break-words text-zinc-100">{version.snapshot.department || "Empty"}</dd>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
              <dt className="text-zinc-500">Knowledge notes</dt>
              <dd className="mt-1 line-clamp-3 break-words text-zinc-100">
                {version.snapshot.knowledge_notes || "Empty"}
              </dd>
            </div>
          </dl>

          <form
            action={action}
            onSubmit={(event) => {
              if (!window.confirm("Restore this saved version? Your current settings will remain in history.")) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="employeeId" value={employeeId} />
            <input type="hidden" name="versionId" value={version.id} />
            <RestoreButton />
          </form>
        </Card>
      ))}
    </div>
  );
}
