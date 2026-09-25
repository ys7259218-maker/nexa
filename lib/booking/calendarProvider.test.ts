import assert from "node:assert/strict";
import test from "node:test";
import { SandboxCalendarProvider } from "./sandboxCalendarProvider.ts";
import { readFileSync } from "node:fs";

const requestedAt = "2026-12-01T09:00:00Z";

test("sandbox provider creates one event per idempotency key and replays it", async () => {
  const provider = new SandboxCalendarProvider();
  const first = await provider.createAppointment({
    idempotencyKey: "nexa:appointment:ws:req",
    requestedAt,
    customerRequest: "Please book a consultation.",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = await provider.createAppointment({
    idempotencyKey: "nexa:appointment:ws:req",
    requestedAt,
    customerRequest: "Please book a consultation.",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.booking.providerBookingId, first.booking.providerBookingId);
  assert.equal(second.booking.startsAt, requestedAt);
  assert.equal(provider.eventCount(), 1);
});

test("sandbox provider booking id never contains customer request text", async () => {
  const provider = new SandboxCalendarProvider();
  const result = await provider.createAppointment({
    idempotencyKey: "nexa:appointment:ws:req",
    requestedAt,
    customerRequest: "PII-looking-private-customer-phrase",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.booking.providerBookingId, /^sandbox-[0-9a-f]{16}-/);
  assert.equal(result.booking.providerBookingId.includes("PII-looking"), false);
  assert.equal(result.booking.provider, "sandbox-calendar");
});

test("sandbox provider rejects a provider call with empty input", async () => {
  const provider = new SandboxCalendarProvider();
  const result = await provider.createAppointment({
    idempotencyKey: "  ",
    requestedAt,
    customerRequest: "",
  });
  assert.deepEqual(result, { ok: false, error: "rejected" });
  assert.equal(provider.eventCount(), 0);
});

test("sandbox provider cancels a booking once and rejects repeats", async () => {
  const provider = new SandboxCalendarProvider();
  const created = await provider.createAppointment({
    idempotencyKey: "nexa:appointment:ws:req",
    requestedAt,
    customerRequest: "Please book a consultation.",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const cancelled = await provider.cancelAppointment({
    providerBookingId: created.booking.providerBookingId,
  });
  assert.equal(cancelled.ok, true);
  const again = await provider.cancelAppointment({
    providerBookingId: created.booking.providerBookingId,
  });
  assert.deepEqual(again, { ok: false, error: "already_cancelled" });
});

test("sandbox provider rejects cancellation of an unknown booking", async () => {
  const provider = new SandboxCalendarProvider();
  const result = await provider.cancelAppointment({ providerBookingId: "unknown-123" });
  assert.deepEqual(result, { ok: false, error: "unknown_booking" });
});

test("sandbox provider reschedules an active booking to a new explicit time", async () => {
  const provider = new SandboxCalendarProvider();
  const created = await provider.createAppointment({
    idempotencyKey: "nexa:appointment:ws:req",
    requestedAt,
    customerRequest: "Please book a consultation.",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const newTime = "2026-12-02T14:30:00Z";
  const rescheduled = await provider.rescheduleAppointment({
    providerBookingId: created.booking.providerBookingId,
    startsAt: newTime,
  });
  assert.equal(rescheduled.ok, true);
  if (!rescheduled.ok) return;
  assert.equal(rescheduled.booking.startsAt, newTime);
  assert.equal(rescheduled.booking.providerBookingId, created.booking.providerBookingId);
});

test("sandbox provider rejects an invalid reschedule time", async () => {
  const provider = new SandboxCalendarProvider();
  const result = await provider.rescheduleAppointment({
    providerBookingId: "whatever",
    startsAt: "not-a-time",
  });
  assert.deepEqual(result, { ok: false, error: "invalid_time" });
});

test("sandbox provider rejects rescheduling of a cancelled booking", async () => {
  const provider = new SandboxCalendarProvider();
  const created = await provider.createAppointment({
    idempotencyKey: "nexa:appointment:ws:req",
    requestedAt,
    customerRequest: "Please book a consultation.",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  await provider.cancelAppointment({ providerBookingId: created.booking.providerBookingId });
  const rescheduled = await provider.rescheduleAppointment({
    providerBookingId: created.booking.providerBookingId,
    startsAt: "2026-12-02T14:30:00Z",
  });
  assert.deepEqual(rescheduled, { ok: false, error: "cancelled_booking" });
});

test("calendar provider abstraction is sandbox-only and has no credential surface", () => {
  const provider = new SandboxCalendarProvider();
  assert.equal(provider.sandboxOnly, true);
  assert.equal(provider.providerName, "sandbox-calendar");
});

test("sandbox provider source imports no network or credential primitives", () => {
  const source = readFileSync(
    new URL("./sandboxCalendarProvider.ts", import.meta.url),
    "utf8",
  );
  for (const forbid of ["fetch(", "HttpClient", "smtp", "tls.connect", "net.connect", "process.env"]) {
    assert.equal(source.includes(forbid), false, `sandbox provider must not import ${forbid}`);
  }
  assert.equal(source.includes("sandboxOnly = true"), true);
});