import Card from "../ui/Card";
import Button from "../ui/Button";
import { buildActivationChecklist, isActivationReady } from "@/lib/employeeActivation";
import type { AIEmployee } from "@/lib/aiEmployees";

type Props = { employee: AIEmployee; channelLinked: boolean; webhookConfigured: boolean; inboundReady: boolean; outboundEnabled: boolean };

export default function DeployAI(props: Props) {
  const checks = buildActivationChecklist(props.employee, {
    linked: props.channelLinked,
    webhookConfigured: props.webhookConfigured,
    inboundReady: props.inboundReady,
    outboundEnabled: props.outboundEnabled,
  });
  const ready = isActivationReady(checks);

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
      <Button disabled title={ready ? "Lifecycle activation control is the next slice" : "Complete every requirement first"}>
        {ready ? "Ready for controlled activation" : "Activation blocked"}
      </Button>
    </Card>
  );
}
