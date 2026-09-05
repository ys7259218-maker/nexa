import type { Metadata } from "next";
import NewAIEmployeeForm from "@/components/ai/NewAIEmployeeForm";
import { requireAuthenticatedUser } from "@/lib/auth";

export const metadata: Metadata = { title: "New AI Employee | Nexa AI" };

export default async function NewAIEmployeePage() {
  await requireAuthenticatedUser();

  return <NewAIEmployeeForm />;
}
