import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

async function setup(context: BrowserContext, page: Page) {
  await context.addCookies([
    { name: 'sigma_access_token', value: 'responsive-test', domain: 'localhost', path: '/' },
  ]);
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const extra: Record<string, object> = {
      '/api/users': {
        items: [
          {
            id: '1',
            name: 'Usuario de prueba',
            email: 'prueba@example.test',
            status: 'ACTIVO',
            roles: [],
          },
        ],
      },
      '/api/students': {
        items: [
          {
            id: '1',
            name: 'Estudiante de prueba',
            matricula: '100000001',
            email: 'estudiante@example.test',
            status: 'ACTIVO',
            careers: [],
          },
        ],
        total: 1,
      },
      '/api/governance/audit': {
        items: [
          {
            id: '1',
            action: 'CREAR',
            entity: 'usuarios',
            entityId: '1',
            createdAt: '2026-09-01T12:00:00Z',
            user: null,
            data: {},
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1, pages: 1 },
        filters: { actions: [], entities: [] },
      },
    };
    if (extra[path]) return route.fulfill({ json: extra[path] });
    const data = path.endsWith('/auth/me')
      ? {
          id: '10',
          name: 'Prueba',
          roles: [{ code: 'ADMIN', name: 'Administrador' }],
          permissions: ['*'],
        }
      : path === '/api/academic/structure'
        ? {
            campuses: [],
            faculties: [],
            schools: [],
            careers: [],
            campusCareers: [],
            studyPlans: [],
            subjects: [
              { id: '1', code: 'INF-101', name: 'Informática', status: 'ACTIVO', credits: 3 },
            ],
          }
        : path === '/api/enrollments'
          ? {
              items: [
                {
                  id: '1',
                  code: 'INS-1',
                  offer: { title: 'Oferta de prueba' },
                  validations: [
                    { id: '2', requirement: 'Identidad', value: 'Correcto', meets: true },
                  ],
                },
              ],
            }
          : path === '/api/payments/bank-accounts'
            ? {
                items: [
                  {
                    id: '3',
                    bank: 'Banco de prueba',
                    accountNumber: '123456789',
                    accountType: 'AHORRO',
                    holderName: 'Titular de prueba',
                    holderDocument: '00000000000',
                    status: 'ACTIVO',
                  },
                ],
              }
            : path === '/api/payments/reconciliations'
              ? {
                  items: [
                    {
                      id: '4',
                      code: 'CON-4',
                      provider: 'CAJA',
                      from: '2026-09-01',
                      to: '2026-09-30',
                      records: 1,
                      amount: 1000,
                      differences: 0,
                      status: 'ABIERTA',
                    },
                    { id: '5', code: 'CON-5', status: 'CERRADA' },
                  ],
                }
              : { items: [], unreadCount: 0 };
    return route.fulfill({ json: data });
  });
}

async function expectInlineActions(cell: Locator) {
  await cell.scrollIntoViewIfNeeded();
  const buttons = cell.getByRole('button');
  const boxes = await buttons.evaluateAll((controls) =>
    controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
  expect(boxes.length).toBeGreaterThan(0);
  const bounds = await cell.boundingBox();
  for (const [index, box] of boxes.entries()) {
    expect(box.width).toBe(44);
    expect(box.height).toBe(44);
    expect(box.top).toBeCloseTo(boxes[0].top, 0);
    expect(box.left).toBeGreaterThanOrEqual(bounds!.x);
    expect(box.right).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    if (index > 0) expect(box.left).toBeGreaterThanOrEqual(boxes[index - 1].right);
  }
}

for (const width of [320, 390, 768, 1366]) {
  test.describe(`controles a ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('asignaturas mantiene los filtros dentro del panel sin solapamientos', async ({
      context,
      page,
    }) => {
      await setup(context, page);
      const hydrationErrors: string[] = [];
      page.on('console', (message) => {
        if (/hydrat|server rendered HTML/i.test(message.text()))
          hydrationErrors.push(message.text());
      });
      await page.goto('/app/asignaturas');
      await expect(page.getByRole('heading', { name: 'Informática', exact: true })).toBeVisible();
      const search = page.getByRole('searchbox', { name: 'Buscar', exact: true });
      const filters = page.getByRole('combobox').filter({ has: page.locator('option[value=""]') });
      await expect(filters).toHaveCount(5);
      const bounds = await search.evaluate((input) => {
        const panel = input.closest('label')!.parentElement!.getBoundingClientRect();
        const controls = [
          ...input.closest('label')!.parentElement!.querySelectorAll('input, select'),
        ];
        return {
          left: panel.left,
          right: panel.right,
          controls: controls.map((control) => {
            const rect = control.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
          }),
        };
      });
      for (const [index, control] of bounds.controls.entries()) {
        expect(control.left).toBeGreaterThanOrEqual(bounds.left - 1);
        expect(control.right).toBeLessThanOrEqual(bounds.right + 1);
        for (const other of bounds.controls.slice(index + 1)) {
          expect(
            control.right <= other.left ||
              other.right <= control.left ||
              control.bottom <= other.top ||
              other.bottom <= control.top,
          ).toBe(true);
        }
      }
      await search.fill('Sin resultados');
      await expect(page.getByText('No existen registros todavía.')).toBeVisible();
      await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Informática', exact: true })).toBeVisible();
      expect(hydrationErrors).toEqual([]);
      await page.screenshot({ path: test.info().outputPath('asignaturas.png'), fullPage: true });
    });

    test('las acciones permanecen en una fila con iconos visibles y abren el registro', async ({
      context,
      page,
    }) => {
      await setup(context, page);
      for (const [slug, labels] of [
        ['validaciones', ['Ver', 'Editar']],
        ['cuentas-bancarias', ['Ver', 'Editar', 'Eliminar']],
        ['conciliaciones', ['Ver', 'Cerrar']],
      ] as const) {
        await page.goto(`/app/${slug}`);
        const row = page.locator('tbody tr').first();
        await expect(row).toBeVisible();
        const actions = row.locator('td').last();
        await expectInlineActions(actions);
        const rows = page.locator('tbody tr');
        for (let index = 1; index < (await rows.count()); index++) {
          const nextCell = rows.nth(index).locator('td').last();
          await expectInlineActions(nextCell);
          const firstButton = await actions.getByRole('button').first().boundingBox();
          const nextButton = await nextCell.getByRole('button').first().boundingBox();
          expect(firstButton!.x).toBeCloseTo(nextButton!.x, 0);
        }
        for (const label of labels) {
          const button = actions.getByRole('button', { name: label, exact: true });
          await expect(button).toBeVisible();
          await expect(button).toHaveAttribute('title', label);
          const icon = await button.locator('svg').boundingBox();
          expect(icon?.width).toBeGreaterThanOrEqual(15);
          expect(icon?.height).toBeGreaterThanOrEqual(15);
        }
        const paginationIcon = await page
          .getByRole('button', { name: 'Página siguiente' })
          .locator('svg')
          .boundingBox();
        expect(paginationIcon?.width).toBeGreaterThanOrEqual(15);
        await page.screenshot({ path: test.info().outputPath(`${slug}.png`), fullPage: true });
        await actions.getByRole('button', { name: 'Ver', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Detalle del registro' })).toBeVisible();
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Cerrar', exact: true })
          .filter({ hasText: 'Cerrar' })
          .click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
    });

    test('usuarios, estudiantes y auditoría mantienen el mismo formato de acciones', async ({
      context,
      page,
    }) => {
      await setup(context, page);
      for (const slug of ['usuarios', 'estudiantes', 'auditoria']) {
        await page.goto(`/app/${slug}`);
        const row = page.locator('tbody tr').first();
        await expect(row).toBeVisible();
        await expectInlineActions(row.locator('td').last());
        if (slug === 'usuarios') {
          await row.getByRole('button', { name: 'Eliminar', exact: true }).click();
          await expect(row.getByRole('button', { name: 'Confirmar', exact: true })).toBeVisible();
          await expectInlineActions(row.locator('td').last());
          await row.getByRole('button', { name: 'Cancelar', exact: true }).click();
        }
        await page.screenshot({ path: test.info().outputPath(`${slug}.png`), fullPage: true });
      }
    });
  });
}
