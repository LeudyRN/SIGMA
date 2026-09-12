import { test, expect, type Page, type BrowserContext } from '@playwright/test';
const enrollment = {
  id: '7',
  code: 'INS-7',
  offerId: '1',
  offer: 'Monográfico Santiago',
  career: 'Psicología',
  campus: 'Santiago',
  degreeType: 'Monográfico',
  teachingMode: 'SEMIPRESENCIAL',
  status: 'PENDIENTE_PAGO',
  receivedAt: '2026-09-08',
  validatedAt: '2026-09-08',
  debtOpenedAt: '2026-09-08',
  channel: 'VIRTUAL',
  amount: 10000,
  currency: 'DOP',
  paid: false,
  whatsappUrl: null,
  remittedAt: null,
  observation: null,
  participants: [
    {
      id: '5',
      registration: '100000001',
      name: 'Estudiante de prueba',
      phone: '+18095550000',
      contactConfirmed: true,
      grade: null,
    },
  ],
  documents: [],
  payments: [],
};
async function setup(
  context: BrowserContext,
  page: Page,
  role: string,
  permissions: string[],
  row = enrollment,
) {
  await context.addCookies([
    { name: 'sigma_access_token', value: 'workflow-test', domain: 'localhost', path: '/' },
  ]);
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/auth/me')
      ? { id: '10', name: 'Prueba', roles: [{ code: role, name: role }], permissions }
      : path === '/api/monograph'
        ? {
            items: [row],
            contact: { phone: '+18095550000', confirmed: true },
            groups: [],
            coordinators: [],
            plans: [],
          }
        : { items: [], metrics: [], unreadCount: 0 };
    return route.fulfill({ json: data });
  });
}
test('student simulates virtual payment without bank data', async ({ context, page }) => {
  await setup(context, page, 'ESTUDIANTE', ['MONOGRAFICO_LEER']);
  await page.goto('/app/pagos');
  await expect(page.getByText('Entorno de simulación.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Simular pago virtual', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('sin movimiento de dinero');
  await page.getByRole('checkbox').check();
  const sent = page.waitForRequest('**/api/monograph/enrollments/7/simulate');
  await page.getByRole('button', { name: 'Ejecutar simulación' }).click();
  expect((await sent).postDataJSON()).toMatchObject({
    channel: 'VIRTUAL',
    outcome: 'APROBADO',
    simulationAcknowledged: true,
  });
  expect(await page.locator('input[type="file"]').count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
test('secretary validates before opening debt', async ({ context, page }) => {
  await setup(context, page, 'SECRETARIA', ['MONOGRAFICO_LEER', 'MONOGRAFICO_VALIDAR'], {
    ...enrollment,
    debtOpenedAt: null,
    validatedAt: null,
    status: 'VALIDANDO',
  } as unknown as typeof enrollment);
  await page.goto('/app/monograficos');
  await expect(page.getByRole('button', { name: 'Crear pago · abrir deuda' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Revisar expediente', exact: true }).click();
  await page.getByLabel('Observación', { exact: true }).fill('Documentación completa');
  await page.getByRole('checkbox').check();
  const sent = page.waitForRequest('**/api/monograph/enrollments/7/validate');
  await page.getByRole('button', { name: 'Validar expediente', exact: true }).click();
  expect((await sent).postDataJSON()).toEqual({
    documentsComplete: true,
    observation: 'Documentación completa',
  });
});
test('cashier sees only the selected cash payment action', async ({ context, page }) => {
  await setup(context, page, 'CAJA', ['MONOGRAFICO_LEER', 'MONOGRAFICO_CAJA'], {
    ...enrollment,
    channel: 'CAJA',
  });
  await page.goto('/app/pagos');
  await expect(page.getByRole('button', { name: 'Simular cobro en Caja' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simular pago virtual', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Revisar expediente', exact: true })).toHaveCount(
    0,
  );
});
test('offers explain the workflow and keep optional requirements collapsed', async ({
  context,
  page,
}) => {
  await setup(context, page, 'ADMIN', ['*']);
  await page.route('**/api/ucotesis/offers', (r) =>
    r.fulfill({ json: { items: [], nextCode: 'E0003' } }),
  );
  await page.route('**/api/ucotesis/catalogs', (r) =>
    r.fulfill({
      json: { campusCareers: [], modalities: [], periods: [], areas: [], requirements: [] },
    }),
  );
  await page.goto('/app/ofertas');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('1. Datos del curso', { exact: true })).toBeVisible();
  await expect(page.getByText('3. Publicación', { exact: true })).toBeAttached();
  await expect(page.locator('select[multiple]')).toHaveCount(0);
  await expect(page.getByLabel('Código automático')).toHaveCount(0);
  await page.getByText('Opciones adicionales (opcional)', { exact: true }).click();
  await expect(
    page.getByText('Las reglas académicas se aplican automáticamente', { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/oferta-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('clerk archives a received document without validation controls', async ({
  context,
  page,
}) => {
  await setup(context, page, 'OFICINISTA', ['MONOGRAFICO_LEER', 'MONOGRAFICO_RECIBIR']);
  await page.route('**/api/enrollments', (r) =>
    r.fulfill({
      json: {
        items: [
          {
            id: '7',
            code: 'INS-7',
            status: 'VALIDANDO',
            offer: { title: 'Monográfico Santiago' },
            documentRequests: [{ id: '9', type: 'Identidad', instructions: 'Copia legible' }],
            documents: [],
          },
        ],
      },
    }),
  );
  await page.goto('/app/documentos');
  await page.getByRole('button', { name: 'Adjuntar documento', exact: true }).click();
  await page.getByLabel('Archivo *').setInputFiles({
    name: 'identidad.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  const sent = page.waitForRequest('**/api/enrollments/received-documents');
  await page.getByRole('button', { name: 'Cargar', exact: true }).click();
  expect((await sent).postData()).toContain('name="requestId"');
  await expect(page.getByRole('button', { name: 'Validar', exact: true })).toHaveCount(0);
});

test('assigned teacher records a grade from the course workspace', async ({ context, page }) => {
  await setup(context, page, 'COORDINADOR_MONOGRAFICO', ['MONOGRAFICO_LEER', 'MONOGRAFICO_NOTAS']);
  await page.route('**/api/monograph', (r) =>
    r.fulfill({
      json: {
        items: [{ ...enrollment, status: 'CONFIRMADA', paid: true }],
        contact: { phone: '', confirmed: true },
        groups: [
          {
            id: '1',
            title: 'Monográfico Santiago',
            coordinatorId: '10',
            coordinator: 'Docente asignado',
            whatsappUrl: '',
            teachingBudget: 0,
            materialsBudget: 0,
            capacity: 10,
            price: 10000,
            remittedAt: null,
          },
        ],
        coordinators: [],
        plans: [],
      },
    }),
  );
  await page.goto('/app/monograficos');
  await page.getByLabel('Nota de 100000001 (0–100)').fill('92');
  await page.getByLabel('Observación de progreso').fill('Evaluación final');
  const sent = page.waitForRequest('**/api/monograph/enrollments/7/grade');
  await page.getByRole('button', { name: 'Guardar nota', exact: true }).click();
  expect((await sent).postDataJSON()).toEqual({
    studentId: '5',
    grade: 92,
    observation: 'Evaluación final',
  });
});

test('head updates the academic exception for a specific study plan', async ({ context, page }) => {
  await setup(context, page, 'ENCARGADO', ['MONOGRAFICO_LEER', 'MONOGRAFICO_REGLAS']);
  await page.route('**/api/monograph', (r) =>
    r.fulfill({
      json: {
        items: [],
        contact: { phone: '', confirmed: true },
        groups: [],
        coordinators: [],
        plans: [
          {
            id: '4',
            name: 'Psicología · Plan 2026',
            maxSubjects: 0,
            maxCredits: 0,
            fromSemester: 1,
          },
        ],
      },
    }),
  );
  await page.goto('/app/monograficos');
  await page.getByRole('button', { name: 'Elegibilidad por plan' }).click();
  await page.getByLabel('Máximo de materias pendientes').fill('2');
  await page.getByLabel('Máximo de créditos pendientes').fill('6');
  await page.getByLabel('Desde el semestre').fill('8');
  const sent = page.waitForRequest('**/api/monograph/plans/4');
  await page.getByRole('button', { name: 'Guardar política' }).click();
  expect((await sent).postDataJSON()).toEqual({ maxSubjects: 2, maxCredits: 6, fromSemester: 8 });
});

test('reconciliation submits the active method code', async ({ context, page }) => {
  await setup(context, page, 'ADMIN', ['*']);
  await page.route('**/api/payments/catalogs', (r) =>
    r.fulfill({
      json: {
        methods: [{ id: '4', code: 'SIMULACION', name: 'Pago de demostración', status: 'ACTIVO' }],
        accounts: [],
      },
    }),
  );
  await page.goto('/app/conciliaciones');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await page.getByLabel('Método o proveedor').selectOption('SIMULACION');
  await page.getByLabel('Desde', { exact: false }).fill('2026-09-01T00:00');
  await page.getByLabel('Hasta', { exact: false }).fill('2026-09-30T23:59');
  const sent = page.waitForRequest('**/api/payments/reconciliations');
  await page.getByRole('button', { name: 'Conciliar', exact: true }).click();
  expect((await sent).postDataJSON().provider).toBe('SIMULACION');
});
test('dashboard and reports have distinct workflows, date filters and scoped exports', async ({
  context,
  page,
}) => {
  await setup(context, page, 'ADMIN', ['*']);
  await page.route(/\/api\/dashboard\/(?:report-)?insights\?/, (r) => {
    const q = new URL(r.request().url()).searchParams;
    return r.fulfill({
      json: {
        generatedAt: '2026-09-08T23:00:00Z',
        period: { from: q.get('from'), to: q.get('to'), days: 7 },
        scope: 'Institucional',
        kpis: {
          enrollments: 12,
          previousEnrollments: 6,
          activeUsers: 8,
          sessions: 18,
          events: 42,
          errors: 2,
          approvedPayments: 3,
        },
        series: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-09-0${i + 1}`,
          enrollments: [1, 3, 0, 4, 1, 2, 1][i],
          sessions: 2 + i,
          events: 4 + i,
        })),
        states: [
          { label: 'Confirmada', total: 6 },
          { label: 'Validando', total: 6 },
        ],
        careers: [
          { label: 'Psicología', total: 8 },
          { label: 'Informática', total: 4 },
        ],
        campuses: [{ label: 'Santiago', total: 12 }],
        teachingModes: [{ label: 'VIRTUAL', total: 12 }],
        modules: [{ label: 'monografico', total: 42 }],
        finances: [{ currency: 'DOP', cash: 10000, virtual: 20000, historical: 0, pending: 10000 }],
        pending: { total: 4, intake: 1, validation: 1, debt: 1, payment: 1, items: [] },
        activity: [
          {
            id: '1',
            action: 'CREAR',
            entity: 'payments/reconciliations',
            actor: 'Leudy Nolasco',
            actorId: '10',
            outcome: 'error',
            date: '2026-09-09T03:24:00Z',
          },
          {
            id: '2',
            action: 'CREAR',
            entity: 'payments/reconciliations',
            actor: 'Leudy Nolasco',
            actorId: '10',
            outcome: 'error',
            date: '2026-09-09T03:23:00Z',
          },
          {
            id: '3',
            action: 'CREAR',
            entity: 'payments/reconciliations',
            actor: 'Leudy Nolasco',
            actorId: '10',
            outcome: 'success',
            date: '2026-09-09T03:21:00Z',
          },
        ],
        methodology: 'Datos del período y pendientes actuales.',
      },
    });
  });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Resumen general', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Tendencia diaria/ })).toBeVisible();
  await expect(page.getByText('Cobertura del proyecto')).toHaveCount(0);
  await expect(
    page.getByText('Leudy Nolasco no pudo crear una conciliación de pagos', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Leudy Nolasco creó una conciliación de pagos', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/2 intentos entre/)).toBeVisible();
  await expect(page.getByText('payments/reconciliations', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pendientes actuales' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Período del reporte' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toHaveCount(0);
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto('/app/reportes');
  await expect(
    page.getByRole('heading', { name: 'Reportes de uso real', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pendientes actuales' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Actividad reciente' })).toHaveCount(0);
  const filtered = page.waitForRequest(/\/api\/dashboard\/report-insights\?/);
  await page.getByRole('combobox', { name: 'Período del reporte' }).selectOption('7');
  const filteredUrl = new URL((await filtered).url());
  expect(
    new Date(filteredUrl.searchParams.get('to')!).getTime() -
      new Date(filteredUrl.searchParams.get('from')!).getTime(),
  ).toBe(6 * 86400000);
  await expect(page.getByRole('heading', { name: 'Detalle diario de solicitudes' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Uso de la plataforma Usuarios, sesiones y acciones' })
    .click();
  await expect(page.getByRole('heading', { name: 'Detalle diario de uso' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Detalle diario de solicitudes' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pagos Aprobaciones e importes' }).click();
  await expect(page.getByRole('columnheader', { name: 'Total simulado' })).toBeVisible();
  await expect(page.getByText('Deuda activa', { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: `test-results/reports-payments-${test.info().project.name}.png`,
    fullPage: true,
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/ucotesis-payments-.*\.csv/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

const coordinationFixture = (student = false) => ({
  offers: [{ id: '1', title: 'Monográfico Informática', teachingMode: 'SEMIPRESENCIAL' }],
  ownTeacherId: student ? null : '4',
  course: {
    id: '1',
    title: 'Monográfico Informática',
    schoolId: '2',
    canPlan: !student,
    canDesignate: !student,
    canManageDocuments: !student,
    designation: {
      teacherId: '4',
      teacher: 'Ana García',
      school: 'Escuela de Informática',
      date: '2026-09-10',
      reference: 'Oficio ESC-2026',
    },
  },
  projects: [
    {
      id: '7',
      title: 'Sistema de biblioteca',
      code: 'INS-7',
      area: 'Software',
      status: 'EN_DESARROLLO',
      students: [{ name: 'María Pérez', registration: '100000001' }],
      canSubmit: student,
      canReview: !student,
      teachers: [
        {
          id: '4',
          name: 'Ana García',
          role: 'Asesor',
          rationale: 'Especialidad en software y horarios compatibles.',
          complexity: 'MEDIA',
        },
      ],
      progress: {
        total: 1,
        approved: 0,
        percent: 0,
        awaitingReview: 1,
        overdue: 0,
        changes: 0,
        oldestReviewDays: 2,
        averageResponseHours: null,
      },
    },
  ],
  milestones: [
    {
      id: '8',
      projectId: null,
      title: 'Primer avance',
      type: 'AVANCE',
      dueAt: '2026-09-18T22:00:00Z',
      instructions: 'Entregar planteamiento y antecedentes.',
      status: 'PROGRAMADO',
      version: 1,
    },
  ],
  submissions: [
    {
      id: '9',
      projectId: '7',
      milestoneId: '8',
      filename: 'avance-1.pdf',
      createdAt: '2026-09-10T18:00:00Z',
      status: 'PENDIENTE',
      feedback: null,
      reviewedAt: null,
    },
  ],
  teachers: student
    ? []
    : [
        {
          id: '4',
          name: 'Ana García',
          canEdit: true,
          groups: 1,
          students: 1,
          profile: {
            specialties: 'Software y bases de datos',
            availability: 'Martes 18:00 a 20:00',
            maxGroups: 5,
            maxStudents: 25,
            available: true,
          },
        },
      ],
  requests: student
    ? []
    : [
        {
          id: '10',
          teacherId: '4',
          teacher: 'Ana García',
          title: 'Expediente de contratación',
          purpose: 'CONTRATACION',
          instructions: 'Adjuntar constancia docente.',
          status: 'PENDIENTE',
          reference: null,
          canUpload: true,
          files: [],
        },
      ],
  generatedAt: '2026-09-10T20:00:00Z',
});
test('coordination plans milestones, reviews work and records assignment criteria', async ({
  context,
  page,
}) => {
  await setup(context, page, 'ADMIN', ['*']);
  await page.route('**/api/coordination**', (r) =>
    r.fulfill({ json: r.request().method() === 'GET' ? coordinationFixture() : { saved: true } }),
  );
  await page.goto('/app/coordinacion-academica');
  await expect(
    page.getByRole('heading', { name: 'Cumplimiento y respuesta por grupo' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cronograma', exact: true }).click();
  await page.getByText('Programar actividad', { exact: true }).click();
  const form = page.locator('details[open]');
  await form.getByLabel('Actividad', { exact: true }).fill('Defensa final');
  await form.getByLabel('Tipo de actividad').selectOption('DEFENSA');
  await form.getByLabel('Fecha y hora límite').fill('2026-09-25T18:00');
  await form.getByLabel('Instrucciones o normativa').fill('Presentar el trabajo ante el jurado.');
  const sent = page.waitForRequest('**/api/coordination/offers/1/milestones');
  await form.getByRole('button', { name: 'Guardar', exact: true }).click();
  expect((await sent).postDataJSON()).toMatchObject({
    type: 'DEFENSA',
    dueAt: '2026-09-25T18:00:00-04:00',
  });
  await page.getByRole('button', { name: 'Trabajos y revisiones', exact: true }).click();
  await page.getByText('Registrar revisión', { exact: true }).click();
  await page.getByLabel('Retroalimentación').fill('Delimitar el alcance de la investigación.');
  await page.getByRole('combobox', { name: /^Resultado/ }).selectOption('CAMBIOS');
  const review = page.waitForRequest('**/api/coordination/submissions/9/review');
  await page.locator('details[open]').getByRole('button', { name: 'Guardar', exact: true }).click();
  expect((await review).postDataJSON()).toMatchObject({
    status: 'CAMBIOS',
    feedback: 'Delimitar el alcance de la investigación.',
  });
  await page.getByRole('button', { name: 'Personal académico', exact: true }).click();
  await page.getByText('Asignar docente al grupo', { exact: true }).click();
  const assignment = page.locator('details[open]');
  await assignment.getByRole('combobox', { name: /^Docente/ }).selectOption('4');
  await assignment
    .getByLabel('Justificación de la asignación')
    .fill('Especialidad en software y disponibilidad confirmada con el grupo.');
  await assignment.getByRole('checkbox').check();
  const assigned = page.waitForRequest('**/api/coordination/projects/7/assignments');
  await assignment.getByRole('button', { name: 'Guardar', exact: true }).click();
  expect((await assigned).postDataJSON()).toMatchObject({
    teacherId: '4',
    participation: 'ASESOR',
    availabilityConfirmed: true,
    complexity: 'BAJA',
  });
  await page.screenshot({
    path: `test-results/coordination-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
test('student sees own academic deliverables without coordination controls', async ({
  context,
  page,
}) => {
  await setup(context, page, 'ESTUDIANTE', ['COORDINACION_ACADEMICA_LEER']);
  await page.route('**/api/coordination**', (r) =>
    r.fulfill({
      json: r.request().method() === 'GET' ? coordinationFixture(true) : { saved: true },
    }),
  );
  await page.goto('/app/coordinacion-academica');
  await page.getByRole('button', { name: 'Cronograma', exact: true }).click();
  await expect(page.getByText('Programar actividad', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Trabajos y revisiones', exact: true }).click();
  await expect(page.getByText('Registrar revisión', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Expedientes docentes', exact: true })).toHaveCount(
    0,
  );
  await page.getByText('Enviar nueva versión', { exact: true }).click();
  await page.getByLabel('Archivo PDF (máximo 8 MB)').setInputFiles({
    name: 'avance.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  const sent = page.waitForRequest('**/api/coordination/projects/7/milestones/8/submissions');
  await page.locator('details[open]').getByRole('button', { name: 'Guardar', exact: true }).click();
  expect((await sent).headers()['content-type']).toContain('multipart/form-data');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
