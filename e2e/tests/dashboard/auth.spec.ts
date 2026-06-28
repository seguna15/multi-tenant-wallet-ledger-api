import { test, expect } from "@playwright/test";

test.describe("Dashboard auth flow", () => {
  test("redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in and reaches the tenants page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_TENANT_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TENANT_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/tenants/);
    await expect(
      page.getByRole("heading", { name: /tenants/i }),
    ).toBeVisible();
  });

  test("logout clears session and redirects to /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_TENANT_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TENANT_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.getByRole("button", { name: /sign ?out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
