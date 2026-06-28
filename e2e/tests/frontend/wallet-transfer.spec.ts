import { test, expect } from "@playwright/test";

test.describe("Wallet & transfer flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/wallet/);
  });

  test("creates a wallet", async ({ page }) => {
    await page.goto("/wallet");
    await page.getByRole("button", { name: /new wallet/i }).click();

    const select = page.getByLabel(/currency/i);
    const currencies = (await select.locator("option").allTextContents())
      .map((c) => c.trim())
      .filter((c) => /^[A-Z]{3}$/.test(c));

    let currency: string | undefined;
    for (const c of currencies) {
      const exists = await page
        .getByRole("button", { name: new RegExp(`^${c}\\b`) })
        .count();
      if (exists === 0) {
        currency = c;
        break;
      }
    }
    if (!currency) {
      test.skip(true, "All available currencies already have a wallet for this user");
    }

    await select.selectOption(currency!);
    await page.getByRole("button", { name: /^create$/i }).click();

    await expect(
      page.getByRole("button", { name: new RegExp(`^${currency}\\b`) }),
    ).toBeVisible();
  });

  test("initiates a transfer by account number and reaches a terminal status", async ({
    page,
  }) => {
    await page.goto("/transfer/new");

    await page.getByLabel(/from wallet/i).click();
    await page.getByRole("option").last().click();
    await page
      .getByLabel(/destination account number/i)
      .fill(process.env.E2E_RECIPIENT_ACCOUNT_NUMBER!);
    await page.getByLabel(/amount/i).fill("10.00");
    await page.getByRole("button", { name: /send transfer/i }).click();

    const status = page.getByTestId("transfer-status-badge");
    await expect(status).toHaveText(/initiated|processing|completed|failed/i);
    await expect(status).toHaveText(/completed|failed/i, { timeout: 15_000 });
  });

  test("shows inline error for unknown account number", async ({ page }) => {
    await page.goto("/transfer/new");
    await page.getByLabel(/destination account number/i).fill("0000000000");
    await page.getByLabel(/amount/i).fill("10.00");

    await expect(
      page.getByText(/account number.*not found|could not find/i),
    ).toBeVisible();
  });
});
