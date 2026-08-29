import { expect, test } from "@playwright/test";

test.describe("public and auth boundary smoke", () => {
  test("health endpoint honors the privacy contract", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(
      response.headers()["cache-control"]?.toLowerCase().includes("no-store"),
    ).toBe(true);

    const body = await response.json();
    expect(Object.keys(body)).toEqual(["status"]);
    expect(body).toEqual({ status: "ready" });
  });

  test("login page is available at /login", async ({ page, baseURL }) => {
    await page.goto("/login");

    const url = new URL(page.url());
    expect(url.origin).toBe(new URL(baseURL!).origin);
    expect(url.pathname).toBe("/login");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome Back",
    );
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("unauthenticated /dashboard fails closed to the local login experience", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/dashboard");

    const url = new URL(page.url());
    expect(url.origin).toBe(new URL(baseURL!).origin);
    expect(["/dashboard", "/login"]).toContain(url.pathname);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome Back",
    );
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });
});
