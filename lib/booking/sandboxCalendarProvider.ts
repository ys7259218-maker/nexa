import { createHash } from "node:crypto";
import type { ConfirmedBooking } from "../actions/appointmentBooking.ts";
import type {
  CalendarProvider,
  CalendarProviderCancelResult,
  CalendarProviderRescheduleResult,
} from "./calendarProvider.ts";

type EventState = "active" | "cancelled";

type SandboxEvent = {
  booking: ConfirmedBooking;
  state: EventState;
};

const MAX_PROVIDER_BOOKING_ID_LENGTH = 200;

function isExplicitTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

/**
 * Deterministic, in-memory, network-free calendar provider used ONLY for
 * sandbox milestone evidence. It creates no external appointment, accepts no
 * credentials and must never be registered in a real runtime path.
 */
export class SandboxCalendarProvider implements CalendarProvider {
  readonly providerName = "sandbox-calendar";
  readonly sandboxOnly = true;

  private readonly eventsByIdempotencyKey = new Map<string, SandboxEvent>();
  private readonly eventsByBookingId = new Map<string, SandboxEvent>();
  private sequence = 0;

  eventCount(): number {
    return this.eventsByBookingId.size;
  }

  private bookingId(idempotencyKey: string): string {
    const digest = createHash("sha256").update(idempotencyKey).digest("hex");
    const tail = idempotencyKey.replace(/\W+/g, "").slice(-32);
    return `sandbox-${digest.slice(0, 16)}-${tail}`.slice(0, MAX_PROVIDER_BOOKING_ID_LENGTH);
  }

  async createAppointment(input: {
    idempotencyKey: string;
    requestedAt: string;
    customerRequest: string;
  }): Promise<{ ok: true; booking: ConfirmedBooking } | { ok: false; error: "rejected" | "unavailable" }> {
    const existing = this.eventsByIdempotencyKey.get(input.idempotencyKey);
    if (existing) {
      return { ok: true, booking: existing.booking };
    }
    if (typeof input.idempotencyKey !== "string" || !input.idempotencyKey.trim() ||
        typeof input.customerRequest !== "string" || !input.customerRequest.trim()) {
      return { ok: false, error: "rejected" };
    }
    const booking: ConfirmedBooking = {
      providerBookingId: this.bookingId(input.idempotencyKey),
      provider: this.providerName,
      startsAt: input.requestedAt,
    };
    const event: SandboxEvent = { booking, state: "active" };
    this.eventsByIdempotencyKey.set(input.idempotencyKey, event);
    this.eventsByBookingId.set(booking.providerBookingId, event);
    this.sequence += 1;
    return { ok: true, booking };
  }

  async cancelAppointment(input: { providerBookingId: string }): Promise<CalendarProviderCancelResult> {
    const event = this.eventsByBookingId.get(input.providerBookingId);
    if (!event) return { ok: false, error: "unknown_booking" };
    if (event.state === "cancelled") return { ok: false, error: "already_cancelled" };
    event.state = "cancelled";
    return { ok: true, booking: event.booking };
  }

  async rescheduleAppointment(input: {
    providerBookingId: string;
    startsAt: string;
  }): Promise<CalendarProviderRescheduleResult> {
    if (!isExplicitTimestamp(input.startsAt)) return { ok: false, error: "invalid_time" };
    const event = this.eventsByBookingId.get(input.providerBookingId);
    if (!event) return { ok: false, error: "unknown_booking" };
    if (event.state === "cancelled") return { ok: false, error: "cancelled_booking" };
    event.booking = { ...event.booking, startsAt: input.startsAt };
    return { ok: true, booking: event.booking };
  }
}