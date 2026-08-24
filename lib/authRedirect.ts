const RECOVERY_DESTINATION = "/reset-password";

export function getSafeRecoveryDestination(candidate: string | null): string {
  return candidate === RECOVERY_DESTINATION ? candidate : RECOVERY_DESTINATION;
}
