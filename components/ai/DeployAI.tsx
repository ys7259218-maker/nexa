"use client";

import { useEffect, useRef, useState } from "react";

import Card from "../ui/Card";
import Button from "../ui/Button";
import SettingsFeedback, { type SettingsMessage } from "./SettingsFeedback";
import { buildActivationChecklist, type ActivationCheck } from "@/lib/employeeActivation";
import type { AIEmployee } from "@/lib/aiEmployees";
import LifecycleControls from "./LifecycleControls";

type EvidenceState = "missing" | "stale" | "incomplete" | "fresh";

type VerificationResult = {
  employeeId: string;
  checks: ActivationCheck[];
  allReady: boolean;
  activationReady: boolean;
  evidenceState: EvidenceState;
  verifiedAt: string | null;
};

type VerificationOutcome =
  | { ok: true; verified: VerificationResult }
  | { ok: false; error: string };

type Props = { employee: AIEmployee; channelLinked: boolean; webhookConfigured: boolean; inboundReady: boolean; outboundEnabled: boolean; lifecycleEnabled: boolean };

const EVIDENCE_DETAIL: Record<EvidenceState, string> = {
  missing: "No trusted server evidence has been recorded for this employee yet.",
  stale: "Trusted server evidence is older than 24 hours and no longer counts.",
  incomplete: "Trusted server evidence is fresh but does not pass every channel or runtime check.",
  fresh: "Trusted server evidence is fresh and complete.",
};

const ERROR_TEXT: Record<string, string> = {
  unauthenticated: "Sign in again to run activation verification.",
  "invalid-target": "This AI Employee reference is invalid.",
  "not-found": "This AI Employee could not be verified under your account.",
  "verifier-unavailable": "The activation verifier is not fully configured on the server.",
  "unauthorized-actor": "You are not allowed to verify this AI Employee.",
};

function verificationErrorText(code: string): string {
  return ERROR_TEXT[code] ?? "Could not complete activation verification. Activation stays locked.";
}

async function requestVerification(employeeId: string): Promise<VerificationOutcome> {
  try {
    const response = await fetch(`/api/ai-employees/${employeeId}/verify-activation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    const body = (await response.json()) as {
      ok?: boolean;
      verified?: VerificationResult;
      error?: string;
    };
    if (!response.ok || !body.ok || !body.verified) {
      return { ok: false, error: verificationErrorText(body.error ?? "unknown") };
    }
    return { ok: true, verified: body.verified };
  } catch {
    return { ok: false, error: "Could not reach the activation verifier. Activation stays locked." };
  }
}

export default function DeployAI({ employee, ...props }: Props) {
  const initialChecks = buildActivationChecklist(employee, {
    linked: props.channelLinked,
    webhookConfigured: props.webhookConfigured,
    inboundReady: props.inboundReady,
    outboundEnabled: props.outboundEnabled,
  });

  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    requestVerification(employee.id).then((outcome) => {
      if (!mounted.current) return;
      setVerifying(false);
      if (!outcome.ok) {
        setResult(null);
        setMessage({ type: "error", text: outcome.error });
        return;
      }
      setResult(outcome.verified);
    });
    return () => {
      mounted.current = false;
    };
  }, [employee.id]);

  async function handleRunVerification() {
    setVerifying(true);
    setMessage(null);
    const outcome = await requestVerification(employee.id);
    if (!mounted.current) return;
    setVerifying(false);
    if (!outcome.ok) {
      setResult(null);
      setMessage({ type: "error", text: outcome.error });
      return;
    }
    setResult(outcome.verified);
  }

  const checks = result?.checks ?? initialChecks;
  const activationReady = result ? result.activationReady : false;

  let bannerText: string;
  if (verifying) {
    bannerText = "Running the trusted server-side activation verification…";
  } else if (!result) {
    bannerText = "Activation locked. The trusted server verification could not confirm readiness.";
  } else if (result.activationReady) {
    bannerText = "Activation verified. Every requirement shows fresh trusted server evidence.";
  } else {
    const unmet = result.checks.filter((check) => !check.ready).map((check) => check.label);
    bannerText = `Activation locked. ${EVIDENCE_DETAIL[result.evidenceState]}${unmet.length ? ` Still required: ${unmet.join(", ")}.` : ""}`;
  }

  const evidenceText = result?.verifiedAt
    ? `Server verification ran at ${new Date(result.verifiedAt).toLocaleString()}.`
    : "No server verification has completed yet.";

  const lockReason = result && !result.activationReady ? bannerText : undefined;

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
        className={
          result?.activationReady
            ? "rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm font-medium text-emerald-200"
            : "rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-200"
        }
      >
        {bannerText}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500" role="status">
          {verifying ? "Verifying…" : evidenceText}
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={verifying}
          aria-busy={verifying}
          onClick={() => void handleRunVerification()}
        >
          {verifying ? "Verifying…" : "Re-run server verification"}
        </Button>
      </div>
      {message ? <SettingsFeedback id="activation-verification-feedback" message={message} /> : null}
      <LifecycleControls employee={employee} activationReady={activationReady} enabled={props.lifecycleEnabled} lockReason={lockReason} />
    </Card>
  );
}
