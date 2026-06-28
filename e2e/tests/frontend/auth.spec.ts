import { test, expect } from "@playwright/test";

test.describe("Frontend auth flow", () => {
  test("redirects unauthenticated user to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in and reaches the wallet page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/wallet/);
    await expect(
      page.getByRole("heading", { name: /my wallets/i }),
    ).toBeVisible();
  });

  test("logout clears session and redirects to /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.getByRole("button", { name: /sign ?out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
