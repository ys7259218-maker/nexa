"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { validateNewPassword } from "@/lib/authValidation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const validationError = validateNewPassword(password);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (password !== confirmation) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage("Password reset is temporarily unavailable.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrorMessage("Unable to update your password. Request a new recovery link and try again.");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?password=updated");
    router.refresh();
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
      <h1 className="text-2xl font-semibold text-white">Choose a new password</h1>
      <p className="mt-2 text-sm text-zinc-400">Use at least 12 characters and do not reuse an old password.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          placeholder="New password"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-white outline-none focus:border-zinc-500"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <input
          type="password"
          name="password-confirmation"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          placeholder="Confirm new password"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-white outline-none focus:border-zinc-500"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />

        {errorMessage ? <p role="alert" className="text-sm text-red-300">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}
