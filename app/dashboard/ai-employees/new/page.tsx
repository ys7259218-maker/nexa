import NewAIEmployeeForm from "@/components/ai/NewAIEmployeeForm";
import { requireAuthenticatedUser } from "@/lib/auth";

export default async function NewAIEmployeePage() {
  await requireAuthenticatedUser();

  return <NewAIEmployeeForm />;
}
