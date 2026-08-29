"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEmail, validateAuthInput } from "@/lib/authValidation";

export default function SignupForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateAuthInput(
      { email, password },
      { requireStrongPassword: true },
    );
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage({ type: "error", text: "Signup is temporarily unavailable. Please try again later." });
      return;
    }

    setMessage(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
    });

    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: "Unable to create the account. Check your details or try again later." });
      return;
    }

    if (!data.session) {
      setMessage({
        type: "success",
        text: "Check your email to confirm your account, then return to login.",
      });
      setPassword("");
      return;
    }

    // Sync the cookie-backed session with server components.
    router.refresh();
    router.push("/dashboard");
  }

  return (
    <div className="w-[420px] bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">

      <h1 className="text-3xl font-bold text-white mb-2">
        Create Account
      </h1>

      <p className="text-zinc-400 mb-6">
        Create your Nexa account
      </p>

      <form
        onSubmit={handleSignup}
        className="space-y-4"
      >

        <div>
          <label htmlFor="email" className="sr-only">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            placeholder="Email"
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-white outline-none focus:border-cyan-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={message?.type === "error"}
            aria-describedby={message?.type === "error" ? "signup-message" : undefined}
          />
        </div>

        <div>
          <label htmlFor="password" className="sr-only">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            placeholder="Password"
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-white outline-none focus:border-cyan-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-invalid={message?.type === "error"}
            aria-describedby={`password-hint ${message?.type === "error" ? "signup-message" : ""}`.trim()}
          />
        </div>

        <p id="password-hint" className="text-xs text-zinc-500">Use at least 12 characters.</p>

        {message ? (
          <p
            id="signup-message"
            role={message.type === "error" ? "alert" : "status"}
            className={message.type === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}
          >
            {message.text}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-cyan-500 p-3 font-semibold text-black hover:bg-cyan-400 transition-all duration-300 disabled:opacity-50"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>

      </form>

    </div>
  );
}
