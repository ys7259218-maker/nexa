"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEmail, validateAuthInput } from "@/lib/authValidation";
import AuthFeedback from "@/components/auth/AuthFeedback";
import PasswordToggle from "@/components/auth/PasswordToggle";

export default function SignupForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="w-full max-w-[420px] rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl sm:p-8">

      <h1 className="text-3xl font-bold text-white mb-2">
        Create Account
      </h1>

      <p className="text-zinc-400 mb-6">
        Create your Nexa account
      </p>

      <form
        onSubmit={handleSignup}
        className="space-y-4"
        aria-busy={loading}
      >

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-200">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            placeholder="you@example.com"
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-white outline-none focus:border-cyan-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={message?.type === "error"}
            aria-describedby={message?.type === "error" ? "signup-message" : undefined}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-200">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              placeholder="Password"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 pr-16 text-white outline-none focus:border-cyan-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-invalid={message?.type === "error"}
              aria-describedby={`password-hint ${message?.type === "error" ? "signup-message" : ""}`.trim()}
            />
            <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((shown) => !shown)} />
          </div>
        </div>

        <p id="password-hint" className="text-xs text-zinc-500">Use at least 12 characters.</p>

        {message ? <AuthFeedback id="signup-message" kind={message.type} message={message.text} /> : null}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full rounded-lg bg-cyan-500 p-3 font-semibold text-black transition-all duration-300 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating Account…" : "Create Account"}
        </button>

      </form>

      <p className="mt-5 text-sm text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="text-cyan-400 hover:text-cyan-300">
          Sign in
        </Link>
      </p>

      <p className="mt-4 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500">
        By creating an account, you agree to the{" "}
        <Link href="/terms" className="text-zinc-400 hover:text-white">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy-policy" className="text-zinc-400 hover:text-white">
          Privacy Policy
        </Link>
        .
      </p>

    </div>
  );
}
