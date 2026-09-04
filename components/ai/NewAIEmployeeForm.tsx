"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createAIEmployee, validateAIEmployeeInput } from "@/lib/aiEmployees";
import { recordActivityEvent } from "@/lib/dashboard";

export default function NewAIEmployeeForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [voice, setVoice] = useState("Female");
  const [language, setLanguage] = useState("English");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    feedbackRef.current?.focus();
  }, [message]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateAIEmployeeInput({
      name,
      business_name: business,
      phone,
      voice,
      language,
    });
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage({ type: "error", text: "Employee creation is temporarily unavailable. Please try again later." });
      return;
    }

    setMessage(null);
    setLoading(true);

    const result = await createAIEmployee(supabase, {
      name: name,
      business_name: business,
      phone: phone,
      voice: voice,
      language: language,
    });

    setLoading(false);

    if (result.error || !result.data) {
      setMessage({ type: "error", text: "Could not create the AI Employee. Please review the details and try again." });
      return;
    }

    await recordActivityEvent(supabase, {
      message: `${result.data.name} was created`,
      category: "general",
    });

    setMessage({ type: "success", text: "AI Employee created. Opening its settings…" });

    router.refresh();
    router.push(`/ai-employees/${result.data.id}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-10">

      <h1 className="text-4xl font-bold mb-8">
        🤖 Create New AI Employee
      </h1>

      <form
        onSubmit={handleCreate}
        className="max-w-2xl space-y-5"
        aria-busy={loading}
      >

        <div>
          <label htmlFor="employee-name" className="mb-1.5 block text-sm font-medium text-zinc-200">AI Employee Name</label>
          <input
            id="employee-name"
            name="employee-name"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"
            placeholder="Customer Support Assistant"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-invalid={message?.type === "error"}
            aria-describedby={message?.type === "error" ? "employee-create-feedback" : undefined}
          />
        </div>

        <div>
          <label htmlFor="business-name" className="mb-1.5 block text-sm font-medium text-zinc-200">Business Name</label>
          <input
            id="business-name"
            name="business-name"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"
            placeholder="Your business"
            maxLength={160}
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            required
            aria-invalid={message?.type === "error"}
            aria-describedby={message?.type === "error" ? "employee-create-feedback" : undefined}
          />
        </div>

        <div>
          <label htmlFor="business-phone" className="mb-1.5 block text-sm font-medium text-zinc-200">Business Phone <span className="text-zinc-500">(optional)</span></label>
          <input
            id="business-phone"
            name="business-phone"
            type="tel"
            autoComplete="tel"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"
            placeholder="+91 98765 43210"
            maxLength={200}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="employee-voice" className="mb-1.5 block text-sm font-medium text-zinc-200">Voice preference</label>
          <select
            id="employee-voice"
            name="employee-voice"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
          >
            <option>Female</option>
            <option>Male</option>
          </select>
        </div>

        <div>
          <label htmlFor="employee-language" className="mb-1.5 block text-sm font-medium text-zinc-200">Language</label>
          <select
            id="employee-language"
            name="employee-language"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option>English</option>
            <option>Hindi</option>
            <option>Hinglish</option>
          </select>
        </div>

        {message ? (
          <p
            ref={feedbackRef}
            id="employee-create-feedback"
            role={message.type === "error" ? "alert" : "status"}
            aria-live={message.type === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            tabIndex={-1}
            className={message.type === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}
          >
            {message.text}
          </p>
        ) : null}

        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${name.trim().length > 0 && business.trim().length > 0 ? "bg-emerald-400" : "bg-amber-400"}`}
            aria-hidden
          />
          <span className="text-zinc-300">
            {name.trim().length > 0 && business.trim().length > 0
              ? "Required details complete — ready to create."
              : "Fill in the AI Employee name and business name to create."}
          </span>
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="rounded-xl bg-cyan-500 px-6 py-3 font-bold text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create AI Employee"}
        </button>

      </form>

    </main>
  );
}
