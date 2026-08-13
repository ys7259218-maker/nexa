"use client";

import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function KnowledgeBase() {
  return (
    <Card className="space-y-6">

      <div>
        <h2 className="text-2xl font-bold">
          Knowledge Base
        </h2>

        <p className="text-zinc-400 mt-1">
          Train your AI Employee with business knowledge.
        </p>
      </div>

      <Input placeholder="Business Website URL" />

      <Input placeholder="FAQ Document" />

      <Input placeholder="Knowledge PDF" />

      <Input placeholder="Business Notes" />

      <div className="pt-2">
        <Button>
          Save Knowledge
        </Button>
      </div>

    </Card>
  );
}