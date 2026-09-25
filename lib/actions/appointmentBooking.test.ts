import assert from "node:assert/strict";
import test from "node:test";
import {
  executeApprovedAppointmentBooking,
  type AppointmentBookingLedger,
  type AppointmentBookingProvider,
  type BookingAuthorization,
  type ConfirmedBooking,
} from "./appointmentBooking.ts";

const authorization: BookingAuthorization = {
  workspaceId: "123e4567-e89b-42d3-a456-426614174000",
  reviewRequestId: "123e4567-e89b-42d3-a456-426614174001",
  requestedAt: "2026-12-01T09:00:00Z",
  customerRequest: "Please book the 9 AM appointment.",
  customerConfirmedAt: "2026-11-30T10:00:00Z",
  humanApprovedAt: "2026-11-30T10:01:00Z",
  humanApprovedByUserId: "123e4567-e89b-42d3-a456-426614174009",
};
const now = new Date("2026-11-30T12:00:00Z");
const booking: ConfirmedBooking = {
  providerBookingId: "evt_synthetic_001",
  provider: "synthetic",
  startsAt: authorization.requestedAt,
};

function fixture(options: {
  claim?: Awaited<ReturnType<AppointmentBookingLedger["claim"]>>;
  provider?: Awaited<ReturnType<AppointmentBookingProvider["createAppointment"]>>;
  complete?: boolean;
  claimThrows?: boolean;
  providerThrows?: boolean;
} = {}) {
  const calls: string[] = [];
  let lastKey = "";
  const ledger: AppointmentBookingLedger = {
    async claim(input) {
      calls.push("claim");
      lastKey = input.idempotencyKey;
      if (options.claimThrows) throw new Error("claim failed");
      return options.claim ?? { status: "acquired" };
    },
    async complete(input) {
      calls.push("complete");
      assert.equal(input.idempotencyKey, lastKey);
      return options.complete ?? true;
    },
    async releaseAfterFailure(input) {
      calls.push("release:" + input.failureCode);
      assert.equal(input.idempotencyKey, lastKey);
    },
  };
  const provider: AppointmentBookingProvider = {
    async createAppointment(input) {
      calls.push("provider");
      assert.equal(input.idempotencyKey, lastKey);
      if (options.providerThrows) throw new Error("provider unavailable");
      return options.provider ?? { ok: true, booking };
    },
  };
  return { ledger, provider, calls, getKey: () => lastKey };
}

test("invalid or stale authorization never reaches ledger or provider", async () => {
  const f = fixture();
  const result = await executeApprovedAppointmentBooking({
    authorization: { ...authorization, requestedAt: "2026-11-30T11:00:00Z" },
    now,
    ledger: f.ledger,
    provider: f.provider,
  });
  assert.deepEqual(result, { ok: false, error: "invalid_authorization" });
  assert.deepEqual(f.calls, []);
});

test("future human approval or customer confirmation is rejected", async () => {
  for (const patch of [
    { humanApprovedAt: "2026-11-30T13:00:00Z" },
    { customerConfirmedAt: "2026-11-30T13:00:00Z" },
  ]) {
    const f = fixture();
    const result = await executeApprovedAppointmentBooking({
      authorization: { ...authorization, ...patch },
      now,
      ledger: f.ledger,
      provider: f.provider,
    });
    assert.deepEqual(result, { ok: false, error: "invalid_authorization" });
    assert.deepEqual(f.calls, []);
  }
});

test("acquired claim creates one provider booking then completes ledger", async () => {
  const f = fixture();
  const result = await executeApprovedAppointmentBooking({
    authorization, now, ledger: f.ledger, provider: f.provider,
  });
  assert.deepEqual(result, { ok: true, status: "confirmed", booking, replayed: false });
  assert.deepEqual(f.calls, ["claim", "provider", "complete"]);
  assert.equal(
    f.getKey(),
    "nexa:appointment:123e4567-e89b-42d3-a456-426614174000:123e4567-e89b-42d3-a456-426614174001",
  );
  assert.equal(f.getKey().includes("Please book"), false);
});

test("already-confirmed replay returns stored booking without provider call", async () => {
  const f = fixture({ claim: { status: "already_confirmed", booking } });
  const result = await executeApprovedAppointmentBooking({
    authorization, now, ledger: f.ledger, provider: f.provider,
  });
  assert.deepEqual(result, { ok: true, status: "confirmed", booking, replayed: true });
  assert.deepEqual(f.calls, ["claim"]);
});

test("in-progress and conflicting claims never call provider", async () => {
  for (const [claim, expected] of [
    [{ status: "in_progress" } as const, "booking_in_progress"],
    [{ status: "conflict" } as const, "authorization_conflict"],
  ] as const) {
    const f = fixture({ claim });
    const result = await executeApprovedAppointmentBooking({
      authorization, now, ledger: f.ledger, provider: f.provider,
    });
    assert.deepEqual(result, { ok: false, error: expected });
    assert.deepEqual(f.calls, ["claim"]);
  }
});

test("provider rejection and outage release the claim without reporting booked", async () => {
  const rejected = fixture({ provider: { ok: false, error: "rejected" } });
  assert.deepEqual(await executeApprovedAppointmentBooking({
    authorization, now, ledger: rejected.ledger, provider: rejected.provider,
  }), { ok: false, error: "provider_rejected" });
  assert.deepEqual(rejected.calls, ["claim", "provider", "release:provider_rejected"]);

  const outage = fixture({ providerThrows: true });
  assert.deepEqual(await executeApprovedAppointmentBooking({
    authorization, now, ledger: outage.ledger, provider: outage.provider,
  }), { ok: false, error: "provider_unavailable" });
  assert.deepEqual(outage.calls, ["claim", "provider", "release:provider_unavailable"]);
});

test("provider result must match authorized requested time", async () => {
  const f = fixture({
    provider: {
      ok: true,
      booking: { ...booking, startsAt: "2026-12-01T10:00:00Z" },
    },
  });
  const result = await executeApprovedAppointmentBooking({
    authorization, now, ledger: f.ledger, provider: f.provider,
  });
  assert.deepEqual(result, { ok: false, error: "invalid_provider_result" });
  assert.deepEqual(f.calls, ["claim", "provider", "release:invalid_provider_result"]);
});

test("ledger failure never returns confirmed even after provider success", async () => {
  const f = fixture({ complete: false });
  const result = await executeApprovedAppointmentBooking({
    authorization, now, ledger: f.ledger, provider: f.provider,
  });
  assert.deepEqual(result, { ok: false, error: "ledger_unavailable" });
  assert.deepEqual(f.calls, ["claim", "provider", "complete"]);
});

test("stored replay with mismatched requested time is treated as authorization conflict", async () => {
  const f = fixture({
    claim: {
      status: "already_confirmed",
      booking: { ...booking, startsAt: "2026-12-01T10:00:00Z" },
    },
  });
  const result = await executeApprovedAppointmentBooking({
    authorization, now, ledger: f.ledger, provider: f.provider,
  });
  assert.deepEqual(result, { ok: false, error: "authorization_conflict" });
  assert.deepEqual(f.calls, ["claim"]);
});

test("claim store outage fails before any provider side effect", async () => {
  const f = fixture({ claimThrows: true });
  const result = await executeApprovedAppointmentBooking({
    authorization, now, ledger: f.ledger, provider: f.provider,
  });
  assert.deepEqual(result, { ok: false, error: "ledger_unavailable" });
  assert.deepEqual(f.calls, ["claim"]);
});
