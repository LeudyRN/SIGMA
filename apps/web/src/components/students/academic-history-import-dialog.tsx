'use client';

import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EntityDialog } from '@/components/ui/entity-dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { FilterSelect, TableFilters } from '@/components/ui/table-filters';

interface ImportIssue {
  code: string;
  message: string;
  periodCode?: string;
  severity: 'ERROR' | 'WARNING';
  subjectCode?: string;
}

interface PreviewRecord {
  action: 'CREAR' | 'ACTUALIZAR' | 'SIN_CAMBIOS';
  courseCode: string;
  credits: number;
  grade: number | null;
  gradeText: string;
  laboratoryGrade: number | null;
  laboratoryGradeText: string | null;
  mapping: 'EXACTA' | 'EQUIVALENCIA' | 'NOMBRE' | 'COMPLEMENTARIA';
  periodCode: string;
  planSubjectCode: string | null;
  planSubjectName: string | null;
  status: string;
  subjectName: string;
}

interface HistoryPreview {
  canImport: boolean;
  document: {
    career: string;
    matricula: string;
    school: string;
    studentName: string;
  };
  issues: ImportIssue[];
  records: PreviewRecord[];
  selectedCareer: {
    campus: string;
    career: string;
    matricula: string;
    plan: string;
    planCode: string;
    studentName: string;
  };
  summary: {
    approved: number;
    approvedCredits: number;
    complementary: number;
    create: number;
    periods: number;
    retired: number;
    total: number;
    unchanged: number;
    update: number;
  };
}

export function AcademicHistoryImportDialog({
  careerId,
  onClose,
  onImported,
}: {
  careerId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<HistoryPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [mapping, setMapping] = useState('');
  const filteredRecords = (preview?.records ?? []).filter((record) => {
    const term = search.trim().toLocaleLowerCase('es');
    return (
      (!mapping || record.mapping === mapping) &&
      (!term ||
        `${record.courseCode} ${record.subjectName} ${record.periodCode}`
          .toLocaleLowerCase('es')
          .includes(term))
    );
  });
  const pagination = usePagination(filteredRecords, 20);

  async function analyze() {
    if (!file) return;
    setLoading(true);
    try {
      const response = await sendFile(
        `/api/students/careers/${careerId}/history/import/preview`,
        file,
      );
      setPreview((await response.json()) as HistoryPreview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible analizar el histórico.');
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!file || !preview?.canImport) return;
    setLoading(true);
    try {
      const response = await sendFile(
        `/api/students/careers/${careerId}/history/import/confirm`,
        file,
      );
      const result = (await response.json()) as {
        created: number;
        unchanged: number;
        updated: number;
      };
      toast.success(
        `Histórico importado: ${result.created} nuevos, ${result.updated} actualizados y ${result.unchanged} sin cambios.`,
      );
      onImported();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible importar el histórico.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <EntityDialog
      open
      onClose={onClose}
      size="xl"
      title="Importar histórico académico"
      description="El PDF se valida contra la matrícula, la carrera, el plan y el catálogo de asignaturas antes de guardar."
    >
      <div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {!preview ? (
            <>
              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-5 text-center transition hover:border-blue-400 hover:bg-blue-50">
                <FileUp className="size-9 text-blue-600" />
                <span className="mt-3 font-bold text-slate-900">Seleccionar histórico PDF</span>
                <span className="mt-1 text-sm text-slate-500">Máximo 15 MB</span>
                {file && (
                  <span className="mt-3 max-w-full truncate rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold">
                    {file.name}
                  </span>
                )}
                <input
                  hidden
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <Button
                type="button"
                onClick={analyze}
                disabled={loading || !file}
                className="mt-4 w-full sm:w-auto"
              >
                {loading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <FileUp className="size-4" />
                )}
                Analizar archivo
              </Button>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Matrícula detectada" value={preview.document.matricula} />
                <Metric label="Estudiante" value={preview.document.studentName} />
                <Metric label="Períodos" value={String(preview.summary.periods)} />
                <Metric
                  label="Créditos aprobados"
                  value={String(preview.summary.approvedCredits)}
                />
              </div>

              <section className="mt-5 rounded-2xl border p-4 sm:p-5">
                <h3 className="font-bold text-slate-950">Validación</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <Validation text={`${preview.summary.total} registros válidos`} />
                  <Validation text={`${preview.summary.approved} aprobadas`} />
                  <Validation text={`${preview.summary.retired} retiradas o AUS`} />
                  <Validation text={`${preview.summary.complementary} complementarias`} />
                </div>
                {preview.issues.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {preview.issues.map((issue, index) => (
                      <p
                        key={`${issue.code}-${issue.periodCode ?? ''}-${issue.subjectCode ?? ''}-${index}`}
                        className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                          issue.severity === 'ERROR'
                            ? 'border-red-200 bg-red-50 text-red-800'
                            : 'border-amber-200 bg-amber-50 text-amber-900'
                        }`}
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        {issue.message}
                      </p>
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-5 overflow-hidden rounded-2xl border">
                <TableFilters
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Código, asignatura o período"
                  totalLabel={`${filteredRecords.length} registros`}
                  hasActiveFilters={Boolean(search || mapping)}
                  onClear={() => {
                    setSearch('');
                    setMapping('');
                  }}
                >
                  <FilterSelect
                    label="Vinculación"
                    value={mapping}
                    onChange={setMapping}
                    options={[
                      { value: '', label: 'Todas' },
                      { value: 'EXACTA', label: 'Código exacto' },
                      { value: 'EQUIVALENCIA', label: 'Equivalencias' },
                      { value: 'NOMBRE', label: 'Por nombre' },
                      { value: 'COMPLEMENTARIA', label: 'Complementarias' },
                    ]}
                  />
                </TableFilters>
                <div className="responsive-table max-w-full overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="p-3">Asignatura</th>
                        <th className="p-3">Período</th>
                        <th className="p-3">Nota</th>
                        <th className="p-3">Resultado</th>
                        <th className="p-3">Vinculación</th>
                        <th className="p-3">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagination.pageItems.map((record) => (
                        <tr key={`${record.periodCode}-${record.courseCode}`} className="border-t">
                          <td className="p-3">
                            <strong>{record.courseCode}</strong>
                            <span className="block text-slate-500">{record.subjectName}</span>
                          </td>
                          <td className="p-3">{record.periodCode}</td>
                          <td className="p-3 font-semibold">
                            <span>{record.grade ?? record.gradeText}</span>
                            {record.laboratoryGradeText && (
                              <span className="block text-xs text-blue-700">
                                Laboratorio: {record.laboratoryGradeText}
                              </span>
                            )}
                          </td>
                          <td className="p-3">{record.status}</td>
                          <td className="p-3">
                            <span className="font-semibold">{record.mapping}</span>
                            {record.planSubjectCode &&
                              record.planSubjectCode !== record.courseCode && (
                                <span className="block text-xs text-slate-500">
                                  {record.planSubjectCode} · {record.planSubjectName}
                                </span>
                              )}
                          </td>
                          <td className="p-3">{record.action.replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  total={filteredRecords.length}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                  pageSizes={[20, 50, 100]}
                />
              </section>
            </>
          )}
        </div>

        {preview && (
          <footer className="flex flex-col-reverse gap-2 border-t bg-slate-50 p-4 sm:flex-row sm:justify-end sm:px-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirm} disabled={loading || !preview.canImport}>
              {loading && <LoaderCircle className="size-4 animate-spin" />}
              Confirmar importación
            </Button>
          </footer>
        )}
      </div>
    </EntityDialog>
  );
}

async function sendFile(path: string, file: File): Promise<Response> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (response.ok) return response;

  let message = 'No fue posible procesar el histórico.';
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join(' ');
    else if (body.message) message = body.message;
  } catch {
    // El proxy puede devolver una respuesta no JSON si la API no está disponible.
  }
  throw new Error(message);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-slate-50 p-4">
      <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="mt-1 font-bold break-words text-slate-950">{value}</p>
    </article>
  );
}

function Validation({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-700">
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
      {text}
    </p>
  );
}
