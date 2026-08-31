"use server";

import { requireAuthenticatedUser } from "@/lib/auth";
import {
  isValidSandboxEmployeeId,
  runEmployeeSandbox,
  validateSandboxCustomerMessage,
} from "@/lib/employeeSandbox";
import { getAIEmployee } from "@/lib/aiEmployees";
import { listVerifiedKnowledgeEntries, type KnowledgeEntry } from "@/lib/knowledgeEntries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EmployeeSandboxActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
  customerMessage: string;
  reply: string | null;
  provider: string | null;
};

export async function simulateEmployeeReply(
  _previousState: EmployeeSandboxActionState,
  formData: FormData,
): Promise<EmployeeSandboxActionState> {
  await requireAuthenticatedUser();

  const employeeId = formData.get("employeeId");
  const customerMessage = formData.get("customerMessage");

  if (!isValidSandboxEmployeeId(employeeId)) {
    return {
      status: "error",
      error: "This AI Employee could not be found.",
      customerMessage: "",
      reply: null,
      provider: null,
    };
  }

  const validation = validateSandboxCustomerMessage(customerMessage);

  if (!validation.ok) {
    return {
      status: "error",
      error: validation.error,
      customerMessage: "",
      reply: null,
      provider: null,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      error: "The safe simulation is temporarily unavailable.",
      customerMessage: validation.value,
      reply: null,
      provider: null,
    };
  }

  const employeeResult = await getAIEmployee(supabase, employeeId);

  if (employeeResult.error) {
    return {
      status: "error",
      error: "The AI Employee could not be loaded. Try again.",
      customerMessage: validation.value,
      reply: null,
      provider: null,
    };
  }

  if (!employeeResult.data) {
    return {
      status: "error",
      error: "This AI Employee could not be found or does not belong to your account.",
      customerMessage: validation.value,
      reply: null,
      provider: null,
    };
  }

  let knowledgeEntries: KnowledgeEntry[] = [];
  const structuredKnowledgeEnabled = process.env.KNOWLEDGE_V0_ENABLED === "true";
  if (structuredKnowledgeEnabled) {
    const knowledgeResult = await listVerifiedKnowledgeEntries(supabase, employeeId);
    if (knowledgeResult.error) {
      return {
        status: "error",
        error: "Verified knowledge could not be loaded. The simulation stopped safely.",
        customerMessage: validation.value,
        reply: null,
        provider: null,
      };
    }
    knowledgeEntries = knowledgeResult.data;
  }

  const result = await runEmployeeSandbox(
    employeeResult.data,
    validation.value,
    knowledgeEntries,
    structuredKnowledgeEnabled,
  );

  if (!result.ok) {
    return {
      status: "error",
      error: result.error,
      customerMessage: validation.value,
      reply: null,
      provider: null,
    };
  }

  return {
    status: "success",
    error: null,
    customerMessage: result.customerMessage,
    reply: result.reply,
    provider: result.provider,
  };
}
