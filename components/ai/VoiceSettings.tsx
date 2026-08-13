"use client";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function VoiceSettings() {
  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Voice Settings
        </h2>

        <p className="text-zinc-400 mt-1">
          Configure how your AI Employee speaks.
        </p>
      </div>


      <Input placeholder="Voice Name" />

      <Input placeholder="Language" />

      <Input placeholder="Accent" />

      <Input placeholder="Speaking Style" />

      <Input placeholder="Speaking Speed" />

      <Input placeholder="Emotion / Tone" />


      <div className="pt-2">
        <Button>
          Save Voice Settings
        </Button>
      </div>

    </Card>
  );
}