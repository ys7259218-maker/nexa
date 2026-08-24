"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function NewAIEmployeeForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [voice, setVoice] = useState("Female");
  const [language, setLanguage] = useState("English");

  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !business) {
      alert("Please fill AI Employee Name and Business Name");
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      alert("Supabase is not configured. Add the variables from .env.example.");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("ai_employees")
      .insert([
        {
          name: name,
          business_name: business,
          phone: phone,
          voice: voice,
          language: language,
        },
      ])
      .select();

    setLoading(false);

    if (error) {
      alert("❌ " + error.message);
      return;
    }

    alert("✅ AI Employee Saved Successfully");

    router.refresh();
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-10">

      <h1 className="text-4xl font-bold mb-8">
        🤖 Create New AI Employee
      </h1>

      <form
        onSubmit={handleCreate}
        className="max-w-2xl space-y-5"
      >

        <input
          className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-700"
          placeholder="AI Employee Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-700"
          placeholder="Business Name"
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
        />

        <input
          className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-700"
          placeholder="Business Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <select
          className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-700"
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
        >
          <option>Female</option>
          <option>Male</option>
        </select>

        <select
          className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-700"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option>English</option>
          <option>Hindi</option>
          <option>Hinglish</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold px-6 py-3 rounded-xl"
        >
          {loading ? "Creating..." : "Create AI Employee"}
        </button>

      </form>

    </main>
  );
}
