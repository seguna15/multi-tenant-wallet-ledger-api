import { test, expect } from '@playwright/test';

test.describe('API key rotation', () => {
  test.beforeEach(async ({ page }) => {
    // No storageState fixture exists in this repo (see dashboard/auth.spec.ts) —
    // log in fresh as the tenant admin before each test.
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_TENANT_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_TENANT_PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/tenants/);
  });

  test('rotates the key, reveals it once, then never shows it again', async ({ page }) => {
    await page.goto('/api-keys');

    // 1. The page only shows metadata about the key — never its value.
    await expect(page.getByText(/last used/i)).toBeVisible();
    await expect(page.getByText(/expires/i)).toBeVisible();

    // 2. "Rotate" opens a confirmation dialog warning that the current key
    // is invalidated immediately.
    await page.getByRole('button', { name: 'Rotate', exact: true }).click();
    const confirmDialog = page.getByRole('dialog', { name: 'Rotate API key' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(/invalidate the current key immediately/i);

    // 3. Confirming rotation calls useRotateApiKey and swaps the dialog
    // content to the "reveal" view.
    await confirmDialog.getByRole('button', { name: 'Confirm rotation' }).click();

    // 4. The new key is shown in plaintext exactly once, with a copy button.
    const revealDialog = page.getByRole('dialog', { name: 'New API key' });
    await expect(revealDialog).toBeVisible();
    await expect(revealDialog).toContainText(/cannot be shown again/i);

    const newKey = (await revealDialog.locator('code').innerText()).trim();
    expect(newKey.length).toBeGreaterThan(0);
    await revealDialog.getByRole('button', { name: 'Copy' }).click();

    // 5. "Done" closes the dialog.
    await revealDialog.getByRole('button', { name: 'Done' }).click();
    await expect(revealDialog).toBeHidden();

    // 6. After a fresh page load, the page is back to showing only metadata —
    // the plaintext key is never persisted or re-displayed.
    await page.reload();
    await expect(page.getByText(/last used/i)).toBeVisible();
    await expect(page.getByText(newKey)).toHaveCount(0);
  });
});
