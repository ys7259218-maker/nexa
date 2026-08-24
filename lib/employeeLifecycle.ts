export type EmployeeLifecycleStatus = "Draft" | "Testing" | "Active" | "Paused" | "Archived";

const TRANSITIONS: Record<EmployeeLifecycleStatus, EmployeeLifecycleStatus[]> = {
  Draft: ["Testing", "Archived"],
  Testing: ["Draft", "Active", "Paused"],
  Active: ["Paused"],
  Paused: ["Testing", "Active", "Archived"],
  Archived: ["Draft"],
};

export function allowedLifecycleTransitions(status: EmployeeLifecycleStatus) {
  return TRANSITIONS[status];
}

export function validateLifecycleTransition(input: {
  from: EmployeeLifecycleStatus;
  to: EmployeeLifecycleStatus;
  activationReady: boolean;
}): string | null {
  if (!TRANSITIONS[input.from].includes(input.to)) return "This lifecycle transition is not allowed.";
  if (input.to === "Active" && !input.activationReady) return "Complete every activation requirement before going active.";
  return null;
}

export function shouldPauseAutomation(status: EmployeeLifecycleStatus) {
  return status !== "Active";
}
