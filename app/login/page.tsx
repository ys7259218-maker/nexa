import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Login | Nexa AI" };

type LoginPageProps = {
  searchParams: Promise<{ password?: string; recovery?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const notice = params.password === "updated"
    ? "Password updated. Sign in with your new password."
    : params.recovery === "invalid"
      ? "That recovery link is invalid or expired. Request a new one."
      : "";

  return (
    <main className="min-h-screen flex items-center justify-center">
      <LoginForm initialNotice={notice} />
    </main>
  );
}
