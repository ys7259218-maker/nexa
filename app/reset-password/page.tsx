import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { requireAuthenticatedUser } from "@/lib/auth";

export default async function ResetPasswordPage() {
  await requireAuthenticatedUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <ResetPasswordForm />
    </main>
  );
}
