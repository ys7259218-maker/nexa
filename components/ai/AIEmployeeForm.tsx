"use client";

import { useState } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";

export default function AIEmployeeForm() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [language, setLanguage] = useState("");

  function handleCreate() {
    console.log({
      name,
      role,
      language,
    });

    alert("AI Employee Created (Demo)");
  }

  return (
    <Card className="space-y-5">
      <h2 className="text-2xl font-bold">
        Create AI Employee
      </h2>

      <Input
        placeholder="AI Employee Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Input
        placeholder="Role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      />

      <Input
        placeholder="Language"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      />

      <Button onClick={handleCreate}>
        Create AI Employee
      </Button>
    </Card>
  );
}