"use client";

import Card from "../ui/Card";
import Button from "../ui/Button";

export default function DeployAI() {
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
          <span>✅ Ready</span>
        </div>

      </div>

      <div className="pt-4">
        <Button>
          🚀 Deploy AI Employee
        </Button>
      </div>

    </Card>
  );
}