'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { EntityDialog } from '@/components/ui/entity-dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { FilterSelect, TableFilters } from '@/components/ui/table-filters';
import { apiFetch, readApiError } from '@/lib/api';

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  status: string;
}

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  userCount: number;
  permissions: Permission[];
}

const roleSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{3,50}$/, 'Usa 3 a 50 letras, números o guiones bajos.'),
  name: z.string().trim().min(3, 'Escribe al menos 3 caracteres.').max(100),
  description: z.string().trim().max(255, 'La descripción es demasiado larga.'),
});

type FormErrors = Record<string, string | undefined>;

async function read<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<T>;
}

async function write<T = unknown>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: object,
): Promise<T | null> {
  const response = await apiFetch(path, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  if (response.status === 204) return null;
  return response.json() as Promise<T>;
}

export function RolesPermissionsPanel() {
  const client = useQueryClient();
  const [roleForm, setRoleForm] = useState({
    code: '',
    name: '',
    description: '',
    status: 'ACTIVO',
  });
  const [rolePermissionIds, setRolePermissionIds] = useState<string[]>([]);
  const [rolePermissionSearch, setRolePermissionSearch] = useState('');
  const [rolePermissionModule, setRolePermissionModule] = useState('');
  const [roleErrors, setRoleErrors] = useState<FormErrors>({});
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'role' | null>(null);
  const [roleSearch, setRoleSearch] = useState('');
  const [roleStatus, setRoleStatus] = useState('');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [permissionModule, setPermissionModule] = useState('');

  const roles = useQuery({
    queryKey: ['identity', 'roles'],
    queryFn: () => read<{ items: Role[] }>('/roles'),
  });
  const permissions = useQuery({
    queryKey: ['identity', 'permissions'],
    queryFn: () => read<{ items: Permission[] }>('/permissions'),
  });
  const filteredRoles =
    roles.data?.items.filter(
      (role) =>
        role.code !== 'ADMIN' &&
        (!roleStatus || role.status === roleStatus) &&
        `${role.code} ${role.name} ${role.description ?? ''}`
          .toLocaleLowerCase('es')
          .includes(roleSearch.trim().toLocaleLowerCase('es')),
    ) ?? [];
  const rolePagination = usePagination(filteredRoles, 6);
  const permissionModules = [
    ...new Set(permissions.data?.items.map((permission) => permission.module) ?? []),
  ].sort();
  const filteredPermissions =
    permissions.data?.items.filter(
      (permission) =>
        (!permissionModule || permission.module === permissionModule) &&
        `${permission.code} ${permission.name} ${permission.description ?? ''}`
          .toLocaleLowerCase('es')
          .includes(permissionSearch.trim().toLocaleLowerCase('es')),
    ) ?? [];
  const permissionPagination = usePagination(filteredPermissions);
  const selectablePermissions =
    permissions.data?.items.filter((permission) => {
      const term = rolePermissionSearch.trim().toLocaleLowerCase('es');
      return (
        permission.status !== 'INACTIVO' &&
        (!rolePermissionModule || permission.module === rolePermissionModule) &&
        `${permission.code} ${permission.name} ${permission.description ?? ''}`
          .toLocaleLowerCase('es')
          .includes(term)
      );
    }) ?? [];
  const rolePermissionPagination = usePagination(selectablePermissions, 8);

  const roleMutation = useMutation({
    mutationFn: async ({
      id,
      body,
      method,
    }: {
      id?: string;
      body?: object;
      method: 'POST' | 'PATCH' | 'DELETE';
    }) => {
      if (method === 'DELETE') return write(id ? `/roles/${id}` : '/roles', method, body);
      const saved = await write<Role>(id ? `/roles/${id}` : '/roles', method, body);
      const roleId = id ?? saved?.id;
      if (!roleId) throw new Error('No fue posible identificar el rol creado.');
      await write(`/roles/${roleId}/permissions`, 'PUT', {
        permissionIds: rolePermissionIds,
      });
      return saved;
    },
    onSuccess: () => {
      toast.success(editingRole ? 'Rol actualizado.' : 'Operación completada.');
      setRoleForm({ code: '', name: '', description: '', status: 'ACTIVO' });
      setRolePermissionIds([]);
      setEditingRole(null);
      setDialog(null);
      setConfirmDelete(null);
      void client.invalidateQueries({ queryKey: ['identity', 'roles'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submitRole() {
    if (rolePermissionIds.length === 0) {
      setRoleErrors((current) => ({
        ...current,
        permissions: 'Selecciona al menos un permiso para definir el alcance del rol.',
      }));
      return;
    }
    const parsed = roleSchema.safeParse({ ...roleForm, code: roleForm.code.toUpperCase() });
    if (!parsed.success) {
      setRoleErrors(firstErrors(z.flattenError(parsed.error).fieldErrors));
      return;
    }
    setRoleErrors({});
    roleMutation.mutate({
      id: editingRole ?? undefined,
      method: editingRole ? 'PATCH' : 'POST',
      body: {
        ...parsed.data,
        ...(editingRole ? { status: roleForm.status } : {}),
      },
    });
  }

  return (
    <section className="w-full space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">
            Identidad y acceso
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Roles y permisos</h1>
          <p className="mt-2 text-slate-600">
            Define responsabilidades y controla las acciones disponibles para cada rol.
          </p>
        </div>
        <div>
          <Button
            type="button"
            onClick={() => {
              setEditingRole(null);
              setRoleForm({ code: '', name: '', description: '', status: 'ACTIVO' });
              setRolePermissionIds([]);
              setRolePermissionSearch('');
              setRolePermissionModule('');
              setRoleErrors({});
              setDialog('role');
            }}
          >
            <Plus className="size-4" /> Crear rol
          </Button>
        </div>
      </header>

      <EntityDialog
        open={dialog === 'role'}
        onClose={() => setDialog(null)}
        title={editingRole ? 'Editar rol' : 'Nuevo rol'}
        description="Define el rol y selecciona exactamente las acciones que podrá realizar. Los permisos disponibles provienen del backend y no se escriben manualmente."
        size="xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-slate-600">
            Código generado por el sistema
            <output className="flex h-11 items-center rounded-xl border bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              {roleForm.code || 'Se generará desde el nombre'}
            </output>
            {roleErrors.code && <span className="font-medium text-red-600">{roleErrors.code}</span>}
          </label>
          <ValidatedInput
            label="Nombre"
            value={roleForm.name}
            error={roleErrors.name}
            onChange={(value) =>
              setRoleForm((form) => ({
                ...form,
                name: value,
                code: editingRole ? form.code : toRoleCode(value),
              }))
            }
          />
          {editingRole && (
            <FilterSelect
              label="Estado"
              value={roleForm.status}
              onChange={(value) => setRoleForm((form) => ({ ...form, status: value }))}
              options={[
                { value: 'ACTIVO', label: 'Activo' },
                { value: 'INACTIVO', label: 'Inactivo' },
              ]}
            />
          )}
          <div className="sm:col-span-2">
            <ValidatedInput
              label="Descripción"
              value={roleForm.description}
              error={roleErrors.description}
              onChange={(value) => setRoleForm((form) => ({ ...form, description: value }))}
            />
          </div>
          <section className="overflow-hidden rounded-2xl border sm:col-span-2">
            <div className="border-b bg-slate-50 px-4 py-3">
              <h3 className="font-bold text-slate-900">Permisos efectivos</h3>
              <p className="mt-1 text-xs text-slate-600">
                Estas selecciones determinan qué vistas y operaciones autorizará el backend.
              </p>
            </div>
            <TableFilters
              search={rolePermissionSearch}
              onSearchChange={setRolePermissionSearch}
              searchPlaceholder="Buscar acción o módulo"
              totalLabel={`${selectablePermissions.length} permisos`}
              hasActiveFilters={Boolean(rolePermissionSearch || rolePermissionModule)}
              onClear={() => {
                setRolePermissionSearch('');
                setRolePermissionModule('');
              }}
            >
              <FilterSelect
                label="Módulo"
                value={rolePermissionModule}
                onChange={setRolePermissionModule}
                options={[
                  { value: '', label: 'Todos los módulos' },
                  ...permissionModules.map((module) => ({ value: module, label: module })),
                ]}
              />
            </TableFilters>
            <div className="grid gap-2 p-3 md:grid-cols-2">
              {rolePermissionPagination.pageItems.map((permission) => (
                <label
                  key={permission.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={rolePermissionIds.includes(permission.id)}
                    onChange={(event) =>
                      setRolePermissionIds((current) =>
                        event.target.checked
                          ? [...current, permission.id]
                          : current.filter((id) => id !== permission.id),
                      )
                    }
                    className="mt-1 size-4"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-800">
                      {permission.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {permission.module} · {permission.code}
                    </span>
                    {permission.description && (
                      <span className="mt-1 block text-xs text-slate-600">
                        {permission.description}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <Pagination
              page={rolePermissionPagination.page}
              pageSize={rolePermissionPagination.pageSize}
              total={selectablePermissions.length}
              onPageChange={rolePermissionPagination.setPage}
              onPageSizeChange={rolePermissionPagination.setPageSize}
              pageSizes={[8, 16, 32]}
            />
          </section>
          {roleErrors.permissions && (
            <p className="text-sm font-semibold text-red-600 sm:col-span-2">
              {roleErrors.permissions}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitRole} disabled={roleMutation.isPending}>
              {roleMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {editingRole ? 'Guardar cambios' : 'Crear rol'}
            </Button>
          </div>
        </div>
      </EntityDialog>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
        <div className="border-b px-4 py-4 sm:px-5">
          <h2 className="text-xl font-bold">Roles</h2>
        </div>
        <TableFilters
          search={roleSearch}
          onSearchChange={setRoleSearch}
          searchPlaceholder="Código, nombre o descripción del rol"
          totalLabel={`${filteredRoles.length} roles`}
          hasActiveFilters={Boolean(roleSearch || roleStatus)}
          onClear={() => {
            setRoleSearch('');
            setRoleStatus('');
          }}
        >
          <FilterSelect
            label="Estado"
            value={roleStatus}
            onChange={setRoleStatus}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'ACTIVO', label: 'Activo' },
              { value: 'INACTIVO', label: 'Inactivo' },
            ]}
          />
        </TableFilters>
        <div className="grid gap-4 p-3 sm:p-5 xl:grid-cols-2">
          {rolePagination.pageItems.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={() => {
                setEditingRole(role.id);
                setRoleForm({
                  code: role.code,
                  name: role.name,
                  description: role.description ?? '',
                  status: role.status,
                });
                setRolePermissionIds(role.permissions.map((permission) => permission.id));
                setRolePermissionSearch('');
                setRolePermissionModule('');
                setRoleErrors({});
                setDialog('role');
              }}
              onDelete={() =>
                confirmDelete === `role-${role.id}`
                  ? roleMutation.mutate({ id: role.id, method: 'DELETE' })
                  : setConfirmDelete(`role-${role.id}`)
              }
              confirmDelete={confirmDelete === `role-${role.id}`}
            />
          ))}
        </div>
        <Pagination
          page={rolePagination.page}
          pageSize={rolePagination.pageSize}
          total={filteredRoles.length}
          onPageChange={rolePagination.setPage}
          onPageSizeChange={rolePagination.setPageSize}
          pageSizes={[6, 12, 24]}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b p-4 sm:p-5">
          <div>
            <h2 className="text-xl font-bold">Catálogo de permisos</h2>
            <p className="text-sm text-slate-500">
              Capacidades reconocidas por el backend. Se consultan aquí y se asignan desde cada rol;
              no se crean códigos libres que la aplicación no pueda interpretar.
            </p>
          </div>
        </div>
        <TableFilters
          search={permissionSearch}
          onSearchChange={setPermissionSearch}
          searchPlaceholder="Código, permiso o descripción"
          totalLabel={`${filteredPermissions.length} permisos`}
          hasActiveFilters={Boolean(permissionSearch || permissionModule)}
          onClear={() => {
            setPermissionSearch('');
            setPermissionModule('');
          }}
        >
          <FilterSelect
            label="Módulo"
            value={permissionModule}
            onChange={setPermissionModule}
            options={[
              { value: '', label: 'Todos los módulos' },
              ...permissionModules.map((module) => ({ value: module, label: module })),
            ]}
          />
        </TableFilters>
        <div className="divide-y">
          {permissionPagination.pageItems.map((permission) => (
            <div
              key={permission.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-slate-100">
                <KeyRound className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{permission.name}</p>
                <p className="text-xs text-slate-500">
                  {permission.module} · {permission.code}
                </p>
                {permission.description && (
                  <p className="mt-1 text-xs text-slate-600">{permission.description}</p>
                )}
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                Registrado
              </span>
            </div>
          ))}
        </div>
        <Pagination
          page={permissionPagination.page}
          pageSize={permissionPagination.pageSize}
          total={filteredPermissions.length}
          onPageChange={permissionPagination.setPage}
          onPageSizeChange={permissionPagination.setPageSize}
        />
      </section>
    </section>
  );
}

function RoleCard({
  role,
  onEdit,
  onDelete,
  confirmDelete,
}: {
  role: Role;
  onEdit: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
}) {
  return (
    <article className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-slate-950">{role.name}</h2>
          <p className="text-xs font-bold text-slate-500">
            {role.code} · {role.userCount} usuarios
          </p>
          <p className="mt-2 text-sm text-slate-600">{role.description}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${role.name}`}
          className="text-blue-700"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Eliminar ${role.name}`}
          className="text-red-700"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {confirmDelete && (
        <p className="mt-3 text-xs font-bold text-red-700">
          Pulsa eliminar nuevamente para confirmar.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {role.permissions.slice(0, 4).map((permission) => (
          <span
            key={permission.id}
            className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
          >
            {permission.name}
          </span>
        ))}
        {role.permissions.length > 4 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            +{role.permissions.length - 4} permisos
          </span>
        )}
      </div>
    </article>
  );
}

function ValidatedInput({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border px-3 text-sm font-normal text-slate-900"
      />
      {error && <span className="font-medium text-red-600">{error}</span>}
    </label>
  );
}

function firstErrors(errors: Record<string, string[] | undefined>): FormErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, messages?.[0]]),
  );
}

function toRoleCode(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}
