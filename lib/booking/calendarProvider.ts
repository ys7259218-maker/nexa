import type {
  AppointmentBookingProvider,
  ConfirmedBooking,
} from "../actions/appointmentBooking.ts";

/** A calendar provider must only ever see the idempotency key plus the exact
 * requested time and sanitized customer request; it never receives credentials,
 * PII-heavy payloads or browser/model-derived authority. */
export type CalendarProviderCancelResult =
  | { ok: true; booking: ConfirmedBooking }
  | { ok: false; error: "unknown_booking" | "already_cancelled" | "unavailable" };

export type CalendarProviderRescheduleResult =
  | { ok: true; booking: ConfirmedBooking }
  | { ok: false; error: "unknown_booking" | "cancelled_booking" | "invalid_time" | "unavailable" };

/**
 * The one calendar-provider abstraction for the booking milestone.
 *
 * It extends the provider-agnostic executor contract with the two lifecycle
 * operations required to exercise cancellation and rescheduling in sandbox
 * E2E evidence. Implementations MUST honor `idempotencyKey` across retries
 * (a provider call can succeed while the local ledger completion later fails).
 *
 * `sandboxOnly` lets review tooling prove that a provider can never be dropped
 * into a live path unnoticed: real integrations must report `false` and pass a
 * separate credentials/consent review before any production wiring.
 */
export interface CalendarProvider extends AppointmentBookingProvider {
  readonly providerName: string;
  readonly sandboxOnly: boolean;
  cancelAppointment(input: { providerBookingId: string }): Promise<CalendarProviderCancelResult>;
  rescheduleAppointment(input: {
    providerBookingId: string;
    startsAt: string;
  }): Promise<CalendarProviderRescheduleResult>;
}