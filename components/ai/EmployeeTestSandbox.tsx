"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import Card from "@/components/ui/Card";
import {
  simulateEmployeeReply,
  type EmployeeSandboxActionState,
} from "@/app/ai-employees/[id]/test/actions";
import { SANDBOX_INPUT_MAX_LENGTH } from "@/lib/employeeSandboxContract";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-100 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Generating safe draft…" : "Generate simulated draft"}
    </button>
  );
}

export default function EmployeeTestSandbox({ employeeId }: { employeeId: string }) {
  const initialState: EmployeeSandboxActionState = {
    status: "idle",
    error: null,
    customerMessage: "",
    reply: null,
    provider: null,
  };
  const [state, action] = useActionState(
    simulateEmployeeReply,
    initialState,
  );

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="rounded-2xl border border-amber-700/60 bg-amber-950/30 p-4">
          <p className="font-semibold text-amber-200">Simulation only — not sent or saved</p>
          <p className="mt-1 text-sm text-amber-100/80">
            This test uses a verified FAQ match when available, otherwise Nexa&apos;s deterministic safe
            mock. It does not contact a customer, call an external AI provider, or write the message
            or draft to the database.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />

          <div className="space-y-2">
            <label htmlFor="customerMessage" className="block font-medium text-zinc-100">
              Simulated customer message
            </label>
            <textarea
              id="customerMessage"
              name="customerMessage"
              required
              maxLength={SANDBOX_INPUT_MAX_LENGTH}
              rows={6}
              placeholder="Example: Hi, are you available on Friday?"
              aria-describedby="sandbox-safety-note"
              className="w-full resize-y rounded-2xl border border-zinc-700 bg-zinc-950/70 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-400 focus:ring-2 focus:ring-white/10"
            />
            <p id="sandbox-safety-note" className="text-sm text-zinc-500">
              Maximum {SANDBOX_INPUT_MAX_LENGTH.toLocaleString()} characters. Test data is processed
              only for this response and is not persisted.
            </p>
          </div>

          <SubmitButton />
        </form>

        {state.status === "error" && state.error ? (
          <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {state.error}
          </div>
        ) : null}
      </Card>

      {state.status === "success" && state.reply ? (
        <div aria-live="polite">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Simulation — not sent
                </p>
                <h2 className="mt-1 text-2xl font-bold">Safe mock draft</h2>
              </div>
              <span className="rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-sm text-emerald-200">
                Provider: {state.provider}
              </span>
            </div>

            <div className="space-y-2 rounded-2xl border border-zinc-800 bg-black/30 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Draft response
              </p>
              <p className="whitespace-pre-wrap text-zinc-100">{state.reply}</p>
            </div>

            <p className="text-sm text-zinc-400">
              Nothing from this simulation was sent to a customer or saved in Nexa.
            </p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
