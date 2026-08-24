"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEmail, validateAuthInput } from "@/lib/authValidation";

export default function LoginForm({ initialNotice = "" }: { initialNotice?: string }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="w-[420px] bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">

      <h1 className="text-3xl font-bold text-white mb-2">
        Welcome Back
      </h1>

      <p className="text-zinc-400 mb-6">
        Login to your Nexa account
      </p>

      <form onSubmit={handleLogin} className="space-y-4">
        {initialNotice ? <p role="status" className="text-sm text-emerald-300">{initialNotice}</p> : null}


        <input
          type="email"
          name="email"
          autoComplete="email"
          maxLength={254}
          placeholder="Email"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-white outline-none focus:border-cyan-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          name="password"
          autoComplete="current-password"
          maxLength={128}
          placeholder="Password"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-white outline-none focus:border-cyan-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-zinc-400 hover:text-white">
            Forgot password?
          </Link>
        </div>

        {errorMessage ? (
          <p role="alert" className="text-sm text-red-300">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-cyan-500 p-3 font-semibold text-black hover:bg-cyan-400 transition-all duration-300 disabled:opacity-50"
        >
          {loading ? "Logging In..." : "Login"}
        </button>

      </form>

    </div>
  );
}
