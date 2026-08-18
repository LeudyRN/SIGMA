import { expect, test } from '@playwright/test';

test('shows the SIGMA institutional landing page', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /sistema de gestión/i })).toBeVisible();
  await expect(page.getByText(/UCOTESIS - UASD Recinto Santiago/i)).toBeVisible();
});

test('shows an accessible login form', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: /inicia sesión en sigma/i })).toBeVisible();
  await expect(page.getByLabel(/^matrícula$/i)).toBeVisible();
  await expect(page.getByLabel(/^contraseña$/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
});

test('protects the planning map until authentication', async ({ page }) => {
  await page.goto('/app');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /inicia sesión en sigma/i })).toBeVisible();
});

test('shows all modules and the organized sidebar after authentication', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'sigma_access_token',
      value: 'e2e-session',
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({
        id: '1',
        uuid: 'e2e-user',
        matricula: '999999999',
        email: 'e2e@uasd.edu.do',
        name: 'Usuario de Prueba',
        roles: [{ code: 'ADMIN', name: 'Administrador' }],
      }),
    });
  });

  await page.goto('/app');
  await expect(page.getByRole('heading', { name: /todos los módulos del sistema/i })).toBeVisible();

  const openMenu = page.getByRole('button', { name: /abrir menú/i });
  if (await openMenu.isVisible()) await openMenu.click();

  await page.getByRole('searchbox', { name: /buscar un módulo/i }).fill('facturas');
  await expect(page.getByRole('link', { name: /facturas digitales/i }).first()).toBeVisible();
});
