"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      alert("Supabase is not configured. Add the variables from .env.example.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("✅ Account Created Successfully");

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

        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-white outline-none focus:border-cyan-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-white outline-none focus:border-cyan-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

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
