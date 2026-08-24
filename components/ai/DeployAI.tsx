import Card from "../ui/Card";
import { buildActivationChecklist, isActivationReady } from "@/lib/employeeActivation";
import type { AIEmployee } from "@/lib/aiEmployees";
import LifecycleControls from "./LifecycleControls";

type Props = { employee: AIEmployee; channelLinked: boolean; webhookConfigured: boolean; inboundReady: boolean; outboundEnabled: boolean; lifecycleEnabled: boolean };

export default function DeployAI(props: Props) {
  const checks = buildActivationChecklist(props.employee, {
    linked: props.channelLinked,
    webhookConfigured: props.webhookConfigured,
    inboundReady: props.inboundReady,
    outboundEnabled: props.outboundEnabled,
  });
  const checklistReady = isActivationReady(checks);
  // The database also requires fresh evidence from a trusted server verifier.
  // That writer is intentionally not implemented yet, so Active stays locked.
  const activationReady = false;

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Activation checklist</h2>
        <p className="mt-1 text-zinc-400">Every requirement needs real evidence before production activation.</p>
      </div>
      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.key} className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0">
            <div><p className="font-medium">{check.label}</p><p className="text-sm text-zinc-500">{check.detail}</p></div>
            <span className={check.ready ? "shrink-0 text-emerald-300" : "shrink-0 text-amber-300"}>{check.ready ? "✅ Ready" : "⚠️ Required"}</span>
          </div>
        ))}
      </div>
      <div
        role="status"
        className="rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-200"
      >
        {checklistReady
          ? "Checklist complete, but activation remains locked until the trusted server verification workflow is connected."
          : "Activation blocked. Complete every required item before changing the lifecycle to Active."}
      </div>
      <LifecycleControls employee={props.employee} activationReady={activationReady} enabled={props.lifecycleEnabled} />
    </Card>
  );
}
