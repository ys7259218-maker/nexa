export type BookingAuthorization = Readonly<{
  workspaceId: string;
  reviewRequestId: string;
  requestedAt: string;
  customerRequest: string;
  customerConfirmedAt: string;
  humanApprovedAt: string;
  humanApprovedByUserId: string;
}>;

export type ConfirmedBooking = Readonly<{
  providerBookingId: string;
  provider: string;
  startsAt: string;
}>;

export interface AppointmentBookingLedger {
  claim(input: {
    idempotencyKey: string;
    workspaceId: string;
    reviewRequestId: string;
  }): Promise<
    | { status: "acquired" }
    | { status: "already_confirmed"; booking: ConfirmedBooking }
    | { status: "in_progress" }
    | { status: "conflict" }
  >;
  complete(input: {
    idempotencyKey: string;
    workspaceId: string;
    reviewRequestId: string;
    booking: ConfirmedBooking;
  }): Promise<boolean>;
  releaseAfterFailure(input: {
    idempotencyKey: string;
    workspaceId: string;
    reviewRequestId: string;
    failureCode: "provider_rejected" | "provider_unavailable" | "invalid_provider_result";
  }): Promise<void>;
}

export interface AppointmentBookingProvider {
  /**
   * Implementations MUST honor idempotencyKey across retries. A provider call
   * can succeed while the local ledger completion later fails; idempotency is
   * the independent guard against duplicate external appointments.
   */
  createAppointment(input: {
    idempotencyKey: string;
    requestedAt: string;
    customerRequest: string;
  }): Promise<
    | { ok: true; booking: ConfirmedBooking }
    | { ok: false; error: "rejected" | "unavailable" }
  >;
}

export type ExecuteAppointmentBookingResult =
  | { ok: true; status: "confirmed"; booking: ConfirmedBooking; replayed: boolean }
  | {
      ok: false;
      error:
        | "invalid_authorization"
        | "not_yet_bookable"
        | "booking_in_progress"
        | "authorization_conflict"
        | "provider_rejected"
        | "provider_unavailable"
        | "invalid_provider_result"
        | "ledger_unavailable";
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CUSTOMER_REQUEST_LENGTH = 1000;
const MIN_FUTURE_LEAD_MS = 60_000;

function explicitTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function validAuthorization(auth: BookingAuthorization, nowMs: number): boolean {
  if (!UUID.test(auth.workspaceId) || !UUID.test(auth.reviewRequestId) || !UUID.test(auth.humanApprovedByUserId)) return false;
  if (!explicitTimestamp(auth.requestedAt) || !explicitTimestamp(auth.customerConfirmedAt) || !explicitTimestamp(auth.humanApprovedAt)) return false;
  if (typeof auth.customerRequest !== "string" || !auth.customerRequest.trim() ||
      auth.customerRequest.length > MAX_CUSTOMER_REQUEST_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(auth.customerRequest)) return false;

  const confirmedAt = Date.parse(auth.customerConfirmedAt);
  const approvedAt = Date.parse(auth.humanApprovedAt);
  const requestedAt = Date.parse(auth.requestedAt);
  if (confirmedAt > nowMs || approvedAt > nowMs) return false;
  if (requestedAt < nowMs + MIN_FUTURE_LEAD_MS) return false;
  return true;
}

function validBooking(booking: ConfirmedBooking, authorization: BookingAuthorization): boolean {
  return typeof booking.providerBookingId === "string" && booking.providerBookingId.length > 0 &&
    booking.providerBookingId.length <= 200 &&
    typeof booking.provider === "string" && booking.provider.length > 0 && booking.provider.length <= 80 &&
    explicitTimestamp(booking.startsAt) &&
    Date.parse(booking.startsAt) === Date.parse(authorization.requestedAt);
}

/**
 * Side-effect boundary for a future real calendar integration.
 *
 * BookingAuthorization must be assembled server-side from independently
 * verified records: human booking approval + customer confirmation + the
 * original review request. Never construct it directly from model output or
 * browser JSON.
 *
 * This module sends no customer message and has no production call site.
 */
export async function executeApprovedAppointmentBooking(input: {
  authorization: BookingAuthorization;
  now: Date;
  ledger: AppointmentBookingLedger;
  provider: AppointmentBookingProvider;
}): Promise<ExecuteAppointmentBookingResult> {
  const nowMs = input.now.getTime();
  if (!Number.isFinite(nowMs) || !validAuthorization(input.authorization, nowMs)) {
    return { ok: false, error: "invalid_authorization" };
  }

  // Keep the key stable and free of customer content/PII.
  const idempotencyKey = `nexa:appointment:${input.authorization.workspaceId}:${input.authorization.reviewRequestId}`;

  let claim: Awaited<ReturnType<AppointmentBookingLedger["claim"]>>;
  try {
    claim = await input.ledger.claim({
      idempotencyKey,
      workspaceId: input.authorization.workspaceId,
      reviewRequestId: input.authorization.reviewRequestId,
    });
  } catch {
    return { ok: false, error: "ledger_unavailable" };
  }

  if (claim.status === "already_confirmed") {
    if (!validBooking(claim.booking, input.authorization)) {
      return { ok: false, error: "authorization_conflict" };
    }
    return { ok: true, status: "confirmed", booking: claim.booking, replayed: true };
  }
  if (claim.status === "in_progress") return { ok: false, error: "booking_in_progress" };
  if (claim.status === "conflict") return { ok: false, error: "authorization_conflict" };

  let providerResult: Awaited<ReturnType<AppointmentBookingProvider["createAppointment"]>>;
  try {
    providerResult = await input.provider.createAppointment({
      idempotencyKey,
      requestedAt: input.authorization.requestedAt,
      customerRequest: input.authorization.customerRequest.trim(),
    });
  } catch {
    try {
      await input.ledger.releaseAfterFailure({
        idempotencyKey,
        workspaceId: input.authorization.workspaceId,
        reviewRequestId: input.authorization.reviewRequestId,
        failureCode: "provider_unavailable",
      });
    } catch {
      // The provider idempotency key remains the duplicate-booking boundary.
    }
    return { ok: false, error: "provider_unavailable" };
  }

  if (!providerResult.ok) {
    const failureCode = providerResult.error === "rejected" ? "provider_rejected" : "provider_unavailable";
    try {
      await input.ledger.releaseAfterFailure({
        idempotencyKey,
        workspaceId: input.authorization.workspaceId,
        reviewRequestId: input.authorization.reviewRequestId,
        failureCode,
      });
    } catch {
      // Fail closed; never report a confirmed booking.
    }
    return { ok: false, error: failureCode };
  }

  if (!validBooking(providerResult.booking, input.authorization)) {
    try {
      await input.ledger.releaseAfterFailure({
        idempotencyKey,
        workspaceId: input.authorization.workspaceId,
        reviewRequestId: input.authorization.reviewRequestId,
        failureCode: "invalid_provider_result",
      });
    } catch {
      // Fail closed.
    }
    return { ok: false, error: "invalid_provider_result" };
  }

  try {
    const completed = await input.ledger.complete({
      idempotencyKey,
      workspaceId: input.authorization.workspaceId,
      reviewRequestId: input.authorization.reviewRequestId,
      booking: providerResult.booking,
    });
    if (!completed) return { ok: false, error: "ledger_unavailable" };
  } catch {
    return { ok: false, error: "ledger_unavailable" };
  }

  return { ok: true, status: "confirmed", booking: providerResult.booking, replayed: false };
}
