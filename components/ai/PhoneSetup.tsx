"use client";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function PhoneSetup() {
  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Phone Setup
        </h2>

        <p className="text-zinc-400 mt-1">
          Configure your AI Employee phone system.
        </p>
      </div>

      <Input placeholder="Business Phone Number" />

      <Input placeholder="Country" />

      <Input placeholder="Business Hours" />

      <Input placeholder="Call Forwarding Number" />

      <Input placeholder="Call Routing Rule" />

      <div className="pt-2">
        <Button>
          Save Phone Settings
        </Button>
      </div>

    </Card>
  );
}