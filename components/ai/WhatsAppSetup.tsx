"use client";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function WhatsAppSetup() {
  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          WhatsApp Setup
        </h2>

        <p className="text-zinc-400 mt-1">
          Configure your AI Employee WhatsApp Business account.
        </p>
      </div>

      <Input placeholder="WhatsApp Business Number" />

      <Input placeholder="Business Name" />

      <Input placeholder="Welcome Message" />

      <Input placeholder="Away Message" />

      <Input placeholder="Auto Reply Message" />

      <Input placeholder="Working Hours" />

      <div className="pt-2">
        <Button>
          Save WhatsApp Settings
        </Button>
      </div>

    </Card>
  );
}