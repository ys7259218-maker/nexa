import { expect, test } from "@playwright/test";

// The smoke server inherits CI env with appointment-review feature OFF.
// These are REAL Next.js HTTP checks, not a substitute for an authenticated
// staging review-flow test when the feature is deliberately enabled.
test.describe("appointment review fail-closed runtime smoke", () => {
  test("unauthenticated queue GET is unavailable while the staging flag is off", async ({ request }) => {
    const response = await request.get("/api/appointment-reviews?workspaceId=123e4567-e89b-42d3-a456-426614174000");
    expect(response.status()).toBe(404);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  test("queue POST cannot create a pending request with the flag off", async ({ request }) => {
    const response = await request.post("/api/appointment-reviews", {
      data: {
        workspaceId: "123e4567-e89b-42d3-a456-426614174000",
        conversationId: "123e4567-e89b-42d3-a456-426614174001",
        inboundMessageId: "123e4567-e89b-42d3-a456-426614174002",
        requestedAt: "2026-10-01T09:00:00Z",
        customerRequest: "synthetic blocked write",
      },
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  test("human decision POST cannot write with the flag off", async ({ request }) => {
    const response = await request.post("/api/appointment-reviews/decision", {
      data: {
        workspaceId: "123e4567-e89b-42d3-a456-426614174000",
        reviewRequestId: "123e4567-e89b-42d3-a456-426614174001",
        decision: "approved_for_manual_followup",
      },
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  test("human review UI is not served when the feature is off", async ({ request }) => {
    const response = await request.get("/appointment-reviews", { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });
});
