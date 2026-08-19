"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { supabase } from "@/lib/supabase";

type DeployAIProps = {
  employeeId: string;
};

export default function DeployAI({
  employeeId,
}: DeployAIProps) {
  const [status, setStatus] = useState("offline");
  const [deployedAt, setDeployedAt] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDeployment() {
      if (!employeeId) return;

      const { data, error } = await supabase
        .from("ai_employees")
        .select("deployment_status, deployed_at")
        .eq("id", employeeId)
        .maybeSingle();

      if (error) {
        console.error(
          "Deployment load error:",
          error
        );
        setMessage(error.message);
      }

      if (data) {
        setStatus(
          data.deployment_status || "offline"
        );

        setDeployedAt(
          data.deployed_at || null
        );
      }

      setLoading(false);
    }

    loadDeployment();
  }, [employeeId]);

  async function deployAI() {
    if (!employeeId) return;

    setDeploying(true);
    setMessage("");

    try {
      const deployedAtValue =
        new Date().toISOString();

      const { error } = await supabase
        .from("ai_employees")
        .update({
          deployment_status: "deployed",
          deployed_at: deployedAtValue,
        })
        .eq("id", employeeId);

      if (error) {
        throw error;
      }

      setStatus("deployed");
      setDeployedAt(deployedAtValue);

      setMessage(
        "AI Employee deployed successfully."
      );
    } catch (error) {
      console.error(
        "Deployment error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to deploy AI Employee."
      );
    } finally {
      setDeploying(false);
    }
  }

  async function disableAI() {
    if (!employeeId) return;

    setDeploying(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("ai_employees")
        .update({
          deployment_status: "offline",
        })
        .eq("id", employeeId);

      if (error) {
        throw error;
      }

      setStatus("offline");

      setMessage(
        "AI Employee is now offline."
      );
    } catch (error) {
      console.error(
        "Disable deployment error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to disable AI Employee."
      );
    } finally {
      setDeploying(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-zinc-400">
          Loading deployment status...
        </p>
      </Card>
    );
  }

  const isDeployed = status === "deployed";

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          Deploy AI
        </h2>

        <p className="text-zinc-400 mt-1">
          Launch your AI Employee into production.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <span>General Settings</span>
          <span>✅ Ready</span>
        </div>

        <div className="flex justify-between">
          <span>Voice Settings</span>
          <span>✅ Ready</span>
        </div>

        <div className="flex justify-between">
          <span>Knowledge Base</span>
          <span>✅ Ready</span>
        </div>

        <div className="flex justify-between">
          <span>Phone Setup</span>
          <span>✅ Ready</span>
        </div>

        <div className="flex justify-between">
          <span>WhatsApp Setup</span>
          <span>⚠️ Not Connected</span>
        </div>
      </div>

      <div className="border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">
            Deployment Status
          </span>

          <span
            className={
              isDeployed
                ? "text-green-400 font-semibold"
                : "text-zinc-400 font-semibold"
            }
          >
            {isDeployed
              ? "🟢 Deployed"
              : "⚪ Offline"}
          </span>
        </div>

        {deployedAt && (
          <p className="text-sm text-zinc-500 mt-2">
            Deployed:{" "}
            {new Date(
              deployedAt
            ).toLocaleString()}
          </p>
        )}
      </div>

      <div className="pt-4 flex gap-3">
        {!isDeployed ? (
          <Button
            onClick={deployAI}
            disabled={deploying}
          >
            {deploying
              ? "Deploying..."
              : "🚀 Deploy AI Employee"}
          </Button>
        ) : (
          <Button
            onClick={disableAI}
            disabled={deploying}
          >
            {deploying
              ? "Updating..."
              : "⏹ Take Offline"}
          </Button>
        )}
      </div>

      {message && (
        <p className="text-sm text-zinc-400">
          {message}
        </p>
      )}
    </Card>
  );
}