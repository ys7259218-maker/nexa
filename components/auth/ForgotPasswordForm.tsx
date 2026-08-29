"use client";

import Link from "next/link";
import { useState } from "react";

import { normalizeEmail, validateEmail } from "@/lib/authValidation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AuthFeedback from "@/components/auth/AuthFeedback";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const validationError = validateEmail(email);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage({ type: "error", text: "Password recovery is temporarily unavailable." });
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: "Unable to send a recovery email. Please try again later." });
      return;
    }

    setMessage({
      type: "success",
      text: "If an account exists for this email, a secure recovery link has been sent.",
    });
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
      <h1 className="text-2xl font-semibold text-white">Reset your password</h1>
      <p className="mt-2 text-sm text-zinc-400">We will email you a secure recovery link.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-busy={loading}>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-200">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-white outline-none focus:border-zinc-500"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-invalid={message?.type === "error"}
            aria-describedby={message?.type === "error" ? "forgot-password-message" : undefined}
          />
        </div>

        {message ? <AuthFeedback id="forgot-password-message" kind={message.type} message={message.text} /> : null}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full rounded-lg bg-white py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send recovery link"}
        </button>
      </form>

      <Link href="/login" className="mt-5 block text-center text-sm text-zinc-400 hover:text-white">
        Back to login
      </Link>
    </section>
  );
}
