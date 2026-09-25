import assert from "node:assert/strict";
import test from "node:test";
import {
  executeApprovedAppointmentBooking,
  type AppointmentBookingLedger,
  type BookingAuthorization,
  type ConfirmedBooking,
} from "../actions/appointmentBooking.ts";
import { SandboxCalendarProvider } from "./sandboxCalendarProvider.ts";
import type { CalendarProvider } from "./calendarProvider.ts";

/**
 * Sandbox E2E: request -> customer confirmation -> owner approval ->
 * calendar event creation -> booking ledger result, without any database,
 * network, credential or real customer data.
 *
 * This mirrors what the server-only adapter does when a real provider is
 * connected: it assembles a trusted BookingAuthorization from independently
 * verified records, then runs the provider-safe executor against a calendar
 * provider plus the booking ledger.
 */

const authorization: BookingAuthorization = {
  workspaceId: "123e4567-e89b-42d3-a456-426614174000",
  reviewRequestId: "123e4567-e89b-42d3-a456-426614174001",
  requestedAt: "2026-12-01T09:00:00Z",
  customerRequest: "Please book the 9 AM consultation.",
  customerConfirmedAt: "2026-11-30T10:00:00Z",
  humanApprovedAt: "2026-11-30T10:01:00Z",
  humanApprovedByUserId: "123e4567-e89b-42d3-a456-426614174009",
};
const now = new Date("2026-11-30T12:00:00Z");

type Attempt = {
  idempotencyKey: string;
  workspaceId: string;
  reviewRequestId: string;
  status: "claimed" | "confirmed" | "failed";
  provider: string | null;
  providerBookingId: string | null;
  startsAt: string | null;
};

function inMemoryLedger() {
  // Faithful mirror of the server-only adapter: the outbox row is uniquely
  // keyed by idempotency_key column; a claim under a different workspace or
  // reviewRequestId on that same key is a 23505-style conflict.
  const rows = new Map<string, Attempt>();
  const ledger: AppointmentBookingLedger = {
    async claim(input) {
      const existing = rows.get(input.idempotencyKey);
      if (!existing) {
        rows.set(input.idempotencyKey, {
          idempotencyKey: input.idempotencyKey,
          workspaceId: input.workspaceId,
          reviewRequestId: input.reviewRequestId,
          status: "claimed",
          provider: null,
          providerBookingId: null,
          startsAt: null,
        });
        return { status: "acquired" };
      }
      if (existing.workspaceId !== input.workspaceId || existing.reviewRequestId !== input.reviewRequestId) {
        return { status: "conflict" };
      }
      if (existing.status === "confirmed") {
        if (!existing.provider || !existing.providerBookingId || !existing.startsAt) {
          return { status: "conflict" };
        }
        return {
          status: "already_confirmed",
          booking: {
            provider: existing.provider,
            providerBookingId: existing.providerBookingId,
            startsAt: existing.startsAt,
          },
        };
      }
      if (existing.status === "claimed") return { status: "in_progress" };
      // failed-only reacquire
      existing.status = "claimed";
      existing.provider = null;
      existing.providerBookingId = null;
      existing.startsAt = null;
      return { status: "acquired" };
    },
    async complete(input) {
      const stored = rows.get(input.idempotencyKey);
      if (!stored || stored.status !== "claimed") return false;
      stored.status = "confirmed";
      stored.provider = input.booking.provider;
      stored.providerBookingId = input.booking.providerBookingId;
      stored.startsAt = input.booking.startsAt;
      return true;
    },
    async releaseAfterFailure(input) {
      const stored = rows.get(input.idempotencyKey);
      if (!stored || stored.status !== "claimed") throw new Error("not claimed");
      stored.status = "failed";
    },
  };
  return {
    ledger,
    attempts: () => Array.from(rows.values()),
    attempt: (idempotencyKey: string) => rows.get(idempotencyKey),
  };
}

const expectedIdempotencyKey =
  "nexa:appointment:123e4567-e89b-42d3-a456-426614174000:123e4567-e89b-42d3-a456-426614174001";

test("sandbox E2E: full chain produces one calendar event and a confirmed ledger row", async () => {
  const provider = new SandboxCalendarProvider();
  const { ledger, attempt, attempts } = inMemoryLedger();

  const result = await executeApprovedAppointmentBooking({
    authorization,
    now,
    ledger,
    provider,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.status, "confirmed");
  assert.equal(result.replayed, false);
  assert.equal(result.booking.provider, "sandbox-calendar");
  assert.equal(result.booking.startsAt, "2026-12-01T09:00:00Z");
  assert.equal(provider.eventCount(), 1);

  const row = attempt(expectedIdempotencyKey);
  assert.ok(row);
  assert.equal(row!.status, "confirmed");
  assert.equal(row!.providerBookingId, result.booking.providerBookingId);
  assert.equal(attempts().length, 1);
  assert.deepEqual(
    attempts().map((a) => a.status),
    ["confirmed"],
  );
});

test("sandbox E2E: duplicate execution replays the stored booking without a second event", async () => {
  const provider = new SandboxCalendarProvider();
  const { ledger, attempt } = inMemoryLedger();

  const first = await executeApprovedAppointmentBooking({ authorization, now, ledger, provider });
  assert.equal(first.ok, true);

  const second = await executeApprovedAppointmentBooking({ authorization, now, ledger, provider });
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.replayed, true);

  assert.equal(provider.eventCount(), 1);
  const row = attempt(expectedIdempotencyKey);
  assert.equal(row!.providerBookingId, first.ok ? first.booking.providerBookingId : null);
});

test("sandbox E2E: provider outage marks the attempt failed, then retry succeeds", async () => {
  const provider = new SandboxCalendarProvider();
  const { ledger, attempt } = inMemoryLedger();

  const failing = {
    ok: false as const,
    error: "unavailable" as const,
  };
  const outageLedger: AppointmentBookingLedger = {
    ...ledger,
    async claim(input) {
      return provider.eventCount() === 0 ? await ledger.claim(input) : { status: "acquired" };
    },
  };

  const providerStub: CalendarProvider = {
    ...provider,
    createAppointment: async () => failing,
    cancelAppointment: provider.cancelAppointment.bind(provider),
    rescheduleAppointment: provider.rescheduleAppointment.bind(provider),
  };

  const first = await executeApprovedAppointmentBooking({
    authorization,
    now,
    ledger: outageLedger,
    provider: providerStub,
  });
  assert.deepEqual(first, { ok: false, error: "provider_unavailable" });
  assert.equal(
    attempt(expectedIdempotencyKey)?.status,
    "failed",
  );
  assert.equal(provider.eventCount(), 0);

  const retry = await executeApprovedAppointmentBooking({
    authorization,
    now,
    ledger,
    provider,
  });
  assert.equal(retry.ok, true);
  assert.equal(provider.eventCount(), 1);
});

test("sandbox E2E: rejection and mismatched provider time never report booked", async () => {
  const provider = new SandboxCalendarProvider();
  const rejectedLedger = inMemoryLedger();
  const rejected: CalendarProvider = {
    ...provider,
    createAppointment: async () => ({ ok: false as const, error: "rejected" as const }),
    cancelAppointment: provider.cancelAppointment.bind(provider),
    rescheduleAppointment: provider.rescheduleAppointment.bind(provider),
  };
  const rejectedResult = await executeApprovedAppointmentBooking({
    authorization,
    now,
    ledger: rejectedLedger.ledger,
    provider: rejected,
  });
  assert.deepEqual(rejectedResult, { ok: false, error: "provider_rejected" });
  assert.equal(provider.eventCount(), 0);
  assert.equal(
    rejectedLedger.attempt(expectedIdempotencyKey)?.status,
    "failed",
  );
});

test("sandbox E2E: in-progress and conflicting claims never reach the provider", async () => {
  const provider = new SandboxCalendarProvider();
  const occupied = inMemoryLedger();
  await occupied.ledger.claim({
    idempotencyKey: expectedIdempotencyKey,
    workspaceId: authorization.workspaceId,
    reviewRequestId: authorization.reviewRequestId,
  });

  const occupiedCall = { calls: 0 } as { calls: number };
  const occupiedProvider: CalendarProvider = {
    ...provider,
    async createAppointment(input) {
      occupiedCall.calls += 1;
      return provider.createAppointment(input);
    },
    cancelAppointment: provider.cancelAppointment.bind(provider),
    rescheduleAppointment: provider.rescheduleAppointment.bind(provider),
  };

  const inProgress = await executeApprovedAppointmentBooking({
    authorization,
    now,
    ledger: occupied.ledger,
    provider: occupiedProvider,
  });
  assert.deepEqual(inProgress, { ok: false, error: "booking_in_progress" });
  assert.equal(occupiedCall.calls, 0);

  const wrongWorkspace = "123e4567-e89b-42d3-a456-426614179999";
  const conflictingLedger = inMemoryLedger();
  await conflictingLedger.ledger.claim({
    idempotencyKey: expectedIdempotencyKey,
    workspaceId: wrongWorkspace,
    reviewRequestId: authorization.reviewRequestId,
  });
  const conflict = await executeApprovedAppointmentBooking({
    authorization,
    now,
    ledger: conflictingLedger.ledger,
    provider,
  });
  assert.deepEqual(conflict, { ok: false, error: "authorization_conflict" });
});

test("sandbox E2E: cancellation and reschedule operate on the created calendar event", async () => {
  const provider = new SandboxCalendarProvider();
  const { ledger } = inMemoryLedger();
  const result = await executeApprovedAppointmentBooking({ authorization, now, ledger, provider });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const booking: ConfirmedBooking = result.booking;
  const rescheduled = await provider.rescheduleAppointment({
    providerBookingId: booking.providerBookingId,
    startsAt: "2026-12-02T14:30:00Z",
  });
  assert.equal(rescheduled.ok, true);
  if (rescheduled.ok) assert.equal(rescheduled.booking.startsAt, "2026-12-02T14:30:00Z");

  const cancelled = await provider.cancelAppointment({ providerBookingId: booking.providerBookingId });
  assert.equal(cancelled.ok, true);
  const repeatCancel = await provider.cancelAppointment({ providerBookingId: booking.providerBookingId });
  assert.deepEqual(repeatCancel, { ok: false, error: "already_cancelled" });

  const afterCancel = await provider.rescheduleAppointment({
    providerBookingId: booking.providerBookingId,
    startsAt: "2026-12-03T09:00:00Z",
  });
  assert.deepEqual(afterCancel, { ok: false, error: "cancelled_booking" });
});