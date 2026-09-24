import { expect, test } from "@playwright/test";

// Runs only in the explicitly opted-in PREVIEW-GATE CI step against the local
// Next.js server. No real account, external DB write, booking, or customer send.
test.describe("appointment-review enabled gate rejects unsafe HTTP requests", () => {
  test("queue POST with missing Origin is forbidden before authentication", async ({ request }) => {
    const response = await request.post("/api/appointment-reviews", {
      data: {
        workspaceId: "123e4567-e89b-42d3-a456-426614174000",
        conversationId: "123e4567-e89b-42d3-a456-426614174001",
        inboundMessageId: "123e4567-e89b-42d3-a456-426614174002",
        requestedAt: "2026-12-01T09:00:00Z",
        customerRequest: "synthetic origin rejection",
      },
    });
    expect(response.status()).toBe(403);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ error: "invalid_origin" });
  });

  test("human-decision POST with cross-site Origin is forbidden", async ({ request }) => {
    const response = await request.post("/api/appointment-reviews/decision", {
      headers: { Origin: "https://attacker.invalid" },
      data: {
        workspaceId: "123e4567-e89b-42d3-a456-426614174000",
        reviewRequestId: "123e4567-e89b-42d3-a456-426614174001",
        decision: "approved_for_manual_followup",
      },
    });
    expect(response.status()).toBe(403);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toEqual({ error: "invalid_origin" });
  });

  test("unauthenticated inbox GET fails instead of returning tenant reviews", async ({ request }) => {
    const response = await request.get("/api/appointment-reviews?workspaceId=123e4567-e89b-42d3-a456-426614174000", { maxRedirects: 0 });
    expect([401, 302, 307, 308]).toContain(response.status());
    expect(response.headers()["cache-control"]).toContain("no-store");
    if (response.status() === 401) {
      expect(await response.json()).toEqual({ error: "unauthenticated" });
    }
  });
});
