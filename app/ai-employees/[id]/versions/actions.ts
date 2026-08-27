"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth";
import { getAIEmployee } from "@/lib/aiEmployees";
import {
  isValidEmployeeVersionId,
  restoreEmployeeVersion,
} from "@/lib/employeeVersions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EmployeeVersionActionState = {
  status: "idle" | "success" | "error";
  error: string | null;
  restoredVersionId: string | null;
};

export async function restoreEmployeeVersionAction(
  _previousState: EmployeeVersionActionState,
  formData: FormData,
): Promise<EmployeeVersionActionState> {
  await requireAuthenticatedUser();

  if (process.env.EMPLOYEE_VERSION_HISTORY_ENABLED !== "true") {
    return {
      status: "error",
      error: "Version restore is not enabled for this deployment.",
      restoredVersionId: null,
    };
  }

  const employeeId = formData.get("employeeId");
  const versionId = formData.get("versionId");

  if (!isValidEmployeeVersionId(employeeId) || !isValidEmployeeVersionId(versionId)) {
    return {
      status: "error",
      error: "This employee version could not be restored.",
      restoredVersionId: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "error",
      error: "Version restore is temporarily unavailable.",
      restoredVersionId: null,
    };
  }

  // Load through the signed-in cookie session before the guarded RPC. This is
  // an independent owner-RLS check; the database function also checks role.
  const employeeResult = await getAIEmployee(supabase, employeeId);
  if (employeeResult.error || !employeeResult.data) {
    return {
      status: "error",
      error: "This AI Employee could not be found or does not belong to your workspace.",
      restoredVersionId: null,
    };
  }

  const result = await restoreEmployeeVersion(supabase, employeeId, versionId);
  if (result.error) {
    return {
      status: "error",
      error: result.error,
      restoredVersionId: null,
    };
  }

  revalidatePath(`/ai-employees/${employeeId}`);
  revalidatePath(`/ai-employees/${employeeId}/versions`);

  return {
    status: "success",
    error: null,
    restoredVersionId: versionId,
  };
}
