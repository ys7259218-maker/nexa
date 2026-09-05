import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Sign Up | Nexa AI" };

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950">
      <SignupForm />
    </main>
  );
}