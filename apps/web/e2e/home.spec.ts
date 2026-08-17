import { expect, test } from '@playwright/test';

test('shows the SIGMA institutional landing page', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /sistema de gestión/i })).toBeVisible();
  await expect(page.getByText(/UCOTESIS - UASD Recinto Santiago/i)).toBeVisible();
});
