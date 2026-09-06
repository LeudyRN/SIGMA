import { expect, test, type Page, type BrowserContext } from '@playwright/test';

async function authenticate(
  context: BrowserContext,
  page: Page,
  role: string,
  permissions: string[],
) {
  await context.addCookies([
    { name: 'sigma_access_token', value: 'workflow-test', domain: 'localhost', path: '/' },
  ]);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(
        path.endsWith('/auth/me')
          ? { id: '10', name: 'Prueba', roles: [{ code: role, name: role }], permissions }
          : { items: [], metrics: [], unreadCount: 0 },
      ),
    });
  });
}
const enrollment = {
  id: '7',
  code: 'INS-7',
  status: 'CONFIRMADA',
  offer: { title: 'Oferta de prueba' },
  documentRequests: [
    { id: '9', type: 'Identidad legible', instructions: 'Adjunta ambos lados de tu documento.' },
  ],
  documents: [],
};

test('teacher reads offers without requesting management catalogs', async ({ context, page }) => {
  await authenticate(context, page, 'DOCENTE', [
    'GENERAL_RESUMEN_LEER',
    'UCOTESIS_OFERTAS_LEER',
    'PROYECTOS_PARTICIPAR',
  ]);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.route('**/api/ucotesis/offers', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: '1',
            title: 'Oferta virtual',
            modality: { name: 'Monográfico' },
            teachingMode: 'VIRTUAL',
            status: 'PUBLICADA',
          },
        ],
      },
    }),
  );
  await page.goto('/app/ofertas');
  await expect(page.getByRole('cell', { name: 'Oferta virtual', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Virtual', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agregar', exact: true })).toHaveCount(0);
  expect(requests.some((url) => url.includes('/ucotesis/catalogs'))).toBe(false);
});

test('coordination requests a document from the documents screen', async ({ context, page }) => {
  await authenticate(context, page, 'COORDINADOR', ['INSCRIPCIONES_GESTIONAR']);
  await page.route('**/api/enrollments', (route) =>
    route.fulfill({ json: { items: [enrollment] } }),
  );
  await page.goto('/app/documentos');
  await page.getByRole('combobox', { name: 'Inscripción', exact: true }).selectOption('7');
  await page.getByLabel('Documento requerido').fill('Carta de solicitud');
  await page
    .getByLabel('Instrucciones para el estudiante')
    .fill('Firma la carta antes de enviarla.');
  const sent = page.waitForRequest('**/api/enrollments/document-requests');
  await page.getByRole('button', { name: 'Solicitar documento', exact: true }).click();
  expect((await sent).postDataJSON()).toEqual({
    enrollmentId: '7',
    type: 'Carta de solicitud',
    instructions: 'Firma la carta antes de enviarla.',
  });
});

test('student answers a request and sees correction instructions', async ({ context, page }) => {
  await authenticate(context, page, 'ESTUDIANTE', ['INSCRIPCIONES_PROPIAS_GESTIONAR']);
  await page.route('**/api/student-portal/enrollments', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            ...enrollment,
            documents: [
              {
                id: '2',
                requestId: '9',
                type: 'Identidad legible',
                name: 'anterior.pdf',
                status: 'RECHAZADO',
                observation: 'La imagen está borrosa.',
              },
            ],
          },
        ],
      },
    }),
  );
  await page.goto('/app/documentos');
  await expect(page.getByText('Adjunta ambos lados de tu documento.')).toBeVisible();
  await page.getByRole('button', { name: 'Corregir documento' }).click();
  await expect(page.getByRole('combobox', { name: 'Inscripción *', exact: true })).toHaveValue('7');
  await expect(
    page.getByRole('combobox', { name: 'Tipo de documento *', exact: true }),
  ).toHaveValue('Identidad legible');
  await page.getByLabel('Archivo *').setInputFiles({
    name: 'identidad.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const sent = page.waitForRequest('**/api/student-portal/documents');
  await page.getByRole('button', { name: 'Cargar', exact: true }).click();
  const body = (await sent).postData() ?? '';
  expect(body).toContain('name="requestId"');
  expect(body).toContain('identidad.pdf');
});

test('audit paginates on the server and displays operation details', async ({ context, page }) => {
  await authenticate(context, page, 'ADMIN', ['GOBIERNO_GESTIONAR']);
  await page.route('**/api/governance/audit?*', (route) => {
    const query = new URL(route.request().url()).searchParams;
    const number = Number(query.get('page') ?? 1);
    return route.fulfill({
      json: {
        items: [
          {
            id: String(number),
            action: 'INICIAR_SESION',
            entity: 'auth/login',
            entityId: '7',
            user: { name: 'Usuario de auditoría', employeeCode: 'EMP-7' },
            createdAt: '2026-09-06T12:00:00Z',
            ip: '127.0.0.1',
            requestId: 'solicitud-7',
            data: { method: 'POST', path: '/api/auth/login', outcome: 'EXITO', statusCode: 200 },
          },
        ],
        pagination: { page: number, pageSize: 20, total: 241, pages: 13 },
        filters: { actions: ['INICIAR_SESION'], entities: ['auth/login'] },
      },
    });
  });
  await page.goto('/app/auditoria');
  await expect(page.getByText('Mostrando 1–20 de 241')).toBeVisible();
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.getByText('Mostrando 21–40 de 241')).toBeVisible();
  await page.getByRole('button', { name: 'Ver evento 2' }).click();
  await expect(page.getByRole('dialog')).toContainText('Usuario de auditoría');
  await expect(page.getByRole('dialog')).toContainText('/api/auth/login');
  await expect(page.getByRole('dialog')).toContainText('Completada');
  await page.screenshot({ path: test.info().outputPath('audit-detail.png'), fullPage: true });
});

test('audit filters search and dates through the API and preserves legacy gaps', async ({
  context,
  page,
}) => {
  await authenticate(context, page, 'ADMIN', ['GOBIERNO_GESTIONAR']);
  await page.route('**/api/governance/audit?*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: '1',
            action: 'CREAR',
            entity: 'sistema',
            entityId: null,
            user: null,
            createdAt: '2026-09-05T12:00:00Z',
            data: {},
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, pages: 1 },
        filters: { actions: ['CREAR'], entities: ['sistema'] },
      },
    }),
  );
  await page.goto('/app/auditoria');
  await expect(
    page.getByRole('cell', { name: 'Sin módulo identificado', exact: true }),
  ).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar evento' }).fill('100001');
  await page.getByLabel('Desde', { exact: true }).fill('2026-09-01');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-09-05');
  const filtered = page.waitForRequest(
    (request) =>
      request.url().includes('/governance/audit?') && request.url().includes('search=100001'),
  );
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  const query = new URL((await filtered).url()).searchParams;
  expect(query.get('page')).toBe('1');
  expect(query.get('from')).toBe('2026-09-01');
  expect(query.get('to')).toBe('2026-09-05');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
