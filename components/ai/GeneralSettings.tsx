"use client";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function GeneralSettings() {
  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          General Settings
        </h2>

        <p className="text-zinc-400 mt-1">
          Configure your AI Employee identity.
        </p>
      </div>

      <Input placeholder="AI Employee Name" />

      <Input placeholder="Role" />

      <Input placeholder="Department" />

      <Input placeholder="Business Description" />

      <Input placeholder="Greeting Message" />

      <Input placeholder="Timezone" />

      <Input placeholder="Working Hours" />

      <Input placeholder="Status (Active / Offline)" />

      <div className="pt-2">
        <Button>
          Save Changes
        </Button>
      </div>
    </Card>
  );
}