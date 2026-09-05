"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEmail, validateAuthInput } from "@/lib/authValidation";
import AuthFeedback from "@/components/auth/AuthFeedback";
import PasswordToggle from "@/components/auth/PasswordToggle";

export default function LoginForm({ initialNotice = "" }: { initialNotice?: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateAuthInput({ email, password });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setErrorMessage("Login is temporarily unavailable. Please try again later.");
      return;
    }

    setErrorMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMessage("Email or password is incorrect.");
      return;
    }

    // Sync the cookie-backed session with server components.
    router.refresh();
    router.push("/dashboard");
  }

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl sm:p-8">

      <h1 className="text-3xl font-bold text-white mb-2">
        Welcome Back
      </h1>

      <p className="text-zinc-400 mb-6">
        Login to your Nexa account
      </p>

      <form onSubmit={handleLogin} className="space-y-4" aria-busy={loading}>
        {initialNotice ? <p role="status" aria-live="polite" className="text-sm text-emerald-300">{initialNotice}</p> : null}

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
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? "login-error" : undefined}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-200">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              maxLength={128}
              placeholder="Password"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 pr-16 text-white outline-none focus:border-cyan-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-invalid={!!errorMessage}
              aria-describedby={errorMessage ? "login-error" : undefined}
            />
            <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((shown) => !shown)} />
          </div>
        </div>

        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-zinc-400 hover:text-white">
            Forgot password?
          </Link>
        </div>

        {errorMessage ? <AuthFeedback id="login-error" kind="error" message={errorMessage} /> : null}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full rounded-lg bg-cyan-500 p-3 font-semibold text-black transition-all duration-300 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Logging In…" : "Login"}
        </button>

      </form>

      <p className="mt-5 text-sm text-zinc-400">
        New to Nexa?{" "}
        <Link href="/signup" className="text-cyan-400 hover:text-cyan-300">
          Create an account
        </Link>
      </p>

    </div>
  );
}
