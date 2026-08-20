'use client';

import { CheckCircle2, FileUp, LoaderCircle } from 'lucide-react';

import { useState } from 'react';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { EntityDialog } from '@/components/ui/entity-dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { TableFilters } from '@/components/ui/table-filters';

interface Campus {
  id: string;
  code?: string;
  name?: string;
}

interface Preview {
  token: string;

  plan: {
    planCode: string;
    careerCode: string;
    career: string;
    faculty: string;
    school: string;

    totalTheoreticalHours: number | null;

    totalPracticalHours: number | null;

    totalCredits: number | null;

    subjects: Array<{
      code: string;
      name: string;

      theoreticalHours: number;
      practicalHours: number;
      credits: number;

      semester: number | null;

      type: string;
    }>;
  };

  detection: {
    careerExists: boolean;
    studyPlanExists: boolean;

    existingSubjects: number;
    newSubjects: number;
  };
}

export function StudyPlanImportDialog({
  campuses,
  onClose,
  onImported,
}: {
  campuses: Campus[];

  onClose: () => void;

  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  const [campusIds, setCampusIds] = useState<string[]>([]);

  const [preview, setPreview] = useState<Preview | null>(null);

  const [loading, setLoading] = useState(false);

  const [subjectSearch, setSubjectSearch] = useState('');
  const filteredSubjects = (preview?.plan.subjects ?? []).filter((subject) => {
    const term = subjectSearch.trim().toLowerCase();
    return !term || `${subject.code} ${subject.name}`.toLowerCase().includes(term);
  });
  const subjectPagination = usePagination(filteredSubjects, 20);

  async function analyze() {
    if (!file) {
      toast.error('Selecciona un PDF.');

      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append('file', file);

      const response = await fetch('/api/academic/study-plans/import/preview', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json();

        throw new Error(body.message ?? 'No fue posible analizar el plan.');
      }

      setPreview(await response.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al analizar el PDF.');
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!preview) return;

    if (!campusIds.length) {
      toast.error('Selecciona al menos un recinto.');

      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/academic/study-plans/import/confirm', {
        method: 'POST',

        credentials: 'include',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          token: preview.token,

          campusIds,
        }),
      });

      if (!response.ok) {
        const body = await response.json();

        throw new Error(body.message ?? 'No fue posible importar el plan.');
      }

      toast.success('Plan de estudios importado correctamente.');

      onImported();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error durante la importación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <EntityDialog
      open
      onClose={onClose}
      size="xl"
      title="Importar plan de estudios"
      description="Sube el PDF oficial, revisa la previsualización y confirma la importación."
    >
      <div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {!preview ? (
            <>
              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-5 text-center transition hover:border-blue-400 hover:bg-blue-50">
                <FileUp className="size-9 text-blue-600" />

                <span className="mt-3 font-bold text-slate-900">Seleccionar PDF</span>

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
                <Metric label="Plan" value={preview.plan.planCode} />

                <Metric label="Carrera" value={preview.plan.career} />

                <Metric label="Asignaturas" value={String(preview.plan.subjects.length)} />

                <Metric label="Créditos" value={String(preview.plan.totalCredits ?? '—')} />
              </div>

              <section className="mt-5 rounded-2xl border p-4 sm:p-5">
                <h3 className="font-bold text-slate-950">Resultado de validación</h3>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Validation
                    text={`${preview.detection.existingSubjects} asignaturas existentes`}
                  />

                  <Validation text={`${preview.detection.newSubjects} asignaturas nuevas`} />

                  <Validation
                    text={
                      preview.detection.careerExists
                        ? 'Carrera encontrada'
                        : 'La carrera será creada'
                    }
                  />

                  <Validation
                    text={preview.detection.studyPlanExists ? 'El plan ya existe' : 'Plan nuevo'}
                  />
                </div>
              </section>

              <section className="mt-5 rounded-2xl border p-4 sm:p-5">
                <div>
                  <h3 className="font-bold text-slate-950">Recintos</h3>

                  <p className="mt-1 text-sm text-slate-500">Selecciona uno, varios o todos.</p>
                </div>

                <button
                  type="button"
                  className="mt-3 text-sm font-bold text-blue-700"
                  onClick={() =>
                    setCampusIds(
                      campusIds.length === campuses.length
                        ? []
                        : campuses.map((campus) => campus.id),
                    )
                  }
                >
                  {campusIds.length === campuses.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {campuses.map((campus) => {
                    const checked = campusIds.includes(campus.id);

                    return (
                      <label
                        key={campus.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border p-3"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCampusIds((current) =>
                              checked
                                ? current.filter((id) => id !== campus.id)
                                : [...current, campus.id],
                            )
                          }
                        />

                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{campus.name}</span>

                          <span className="block text-xs text-slate-500">{campus.code}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="mt-5 overflow-hidden rounded-2xl border">
                <div className="border-b bg-slate-50 px-4 py-3">
                  <h3 className="font-bold">Asignaturas detectadas</h3>
                </div>

                <TableFilters
                  search={subjectSearch}
                  onSearchChange={setSubjectSearch}
                  searchPlaceholder="Buscar por clave o asignatura"
                  hasActiveFilters={Boolean(subjectSearch)}
                  onClear={() => setSubjectSearch('')}
                  totalLabel={`${filteredSubjects.length} asignaturas`}
                />

                <div className="responsive-table">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b bg-white">
                        <th className="p-3">Clave</th>

                        <th className="p-3">Asignatura</th>

                        <th className="p-3">HT</th>

                        <th className="p-3">HP</th>

                        <th className="p-3">CR</th>

                        <th className="p-3">Sem.</th>
                      </tr>
                    </thead>

                    <tbody>
                      {subjectPagination.pageItems.map((subject) => (
                        <tr key={subject.code} className="border-b last:border-0">
                          <td className="p-3 font-bold">{subject.code}</td>

                          <td className="p-3">{subject.name}</td>

                          <td className="p-3">{subject.theoreticalHours}</td>

                          <td className="p-3">{subject.practicalHours}</td>

                          <td className="p-3">{subject.credits}</td>

                          <td className="p-3">{subject.semester ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={subjectPagination.page}
                  pageSize={subjectPagination.pageSize}
                  total={filteredSubjects.length}
                  onPageChange={subjectPagination.setPage}
                  onPageSizeChange={subjectPagination.setPageSize}
                  pageSizes={[20, 50, 100]}
                />
              </section>
            </>
          )}
        </div>

        {preview && (
          <footer className="flex flex-col-reverse gap-2 border-t bg-slate-50 p-4 sm:flex-row sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={confirm}
              disabled={loading || !campusIds.length}
              className="w-full sm:w-auto"
            >
              {loading && <LoaderCircle className="size-4 animate-spin" />}
              Importar plan
            </Button>
          </footer>
        )}
      </div>
    </EntityDialog>
  );
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
