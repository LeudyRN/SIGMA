'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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

const permissionSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{3,100}$/, 'Código inválido.'),
  name: z.string().trim().min(3, 'Escribe al menos 3 caracteres.').max(120),
  module: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{3,80}$/, 'Módulo inválido.'),
  description: z.string().trim().max(255, 'La descripción es demasiado larga.'),
});

type FormErrors = Record<string, string | undefined>;

async function read<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<T>;
}

async function write(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: object) {
  const response = await apiFetch(path, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

export function RolesPermissionsPanel() {
  const client = useQueryClient();
  const [roleForm, setRoleForm] = useState({ code: '', name: '', description: '' });
  const [permissionForm, setPermissionForm] = useState({
    code: '',
    name: '',
    module: '',
    description: '',
  });
  const [roleErrors, setRoleErrors] = useState<FormErrors>({});
  const [permissionErrors, setPermissionErrors] = useState<FormErrors>({});
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingPermission, setEditingPermission] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const roles = useQuery({
    queryKey: ['identity', 'roles'],
    queryFn: () => read<{ items: Role[] }>('/roles'),
  });
  const permissions = useQuery({
    queryKey: ['identity', 'permissions'],
    queryFn: () => read<{ items: Permission[] }>('/permissions'),
  });

  const roleMutation = useMutation({
    mutationFn: async ({
      id,
      body,
      method,
    }: {
      id?: string;
      body?: object;
      method: 'POST' | 'PATCH' | 'DELETE';
    }) => write(id ? `/roles/${id}` : '/roles', method, body),
    onSuccess: () => {
      toast.success(editingRole ? 'Rol actualizado.' : 'Operación completada.');
      setRoleForm({ code: '', name: '', description: '' });
      setEditingRole(null);
      setConfirmDelete(null);
      void client.invalidateQueries({ queryKey: ['identity', 'roles'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const permissionMutation = useMutation({
    mutationFn: async ({
      id,
      body,
      method,
    }: {
      id?: string;
      body?: object;
      method: 'POST' | 'PATCH' | 'DELETE';
    }) => write(id ? `/permissions/${id}` : '/permissions', method, body),
    onSuccess: () => {
      toast.success(editingPermission ? 'Permiso actualizado.' : 'Operación completada.');
      setPermissionForm({ code: '', name: '', module: '', description: '' });
      setEditingPermission(null);
      setConfirmDelete(null);
      void client.invalidateQueries({ queryKey: ['identity', 'permissions'] });
      void client.invalidateQueries({ queryKey: ['identity', 'roles'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submitRole() {
    const parsed = roleSchema.safeParse({ ...roleForm, code: roleForm.code.toUpperCase() });
    if (!parsed.success) {
      setRoleErrors(firstErrors(z.flattenError(parsed.error).fieldErrors));
      return;
    }
    setRoleErrors({});
    roleMutation.mutate({
      id: editingRole ?? undefined,
      method: editingRole ? 'PATCH' : 'POST',
      body: parsed.data,
    });
  }

  function submitPermission() {
    const parsed = permissionSchema.safeParse({
      ...permissionForm,
      code: permissionForm.code.toUpperCase(),
      module: permissionForm.module.toUpperCase(),
    });
    if (!parsed.success) {
      setPermissionErrors(firstErrors(z.flattenError(parsed.error).fieldErrors));
      return;
    }
    setPermissionErrors({});
    permissionMutation.mutate({
      id: editingPermission ?? undefined,
      method: editingPermission ? 'PATCH' : 'POST',
      body: parsed.data,
    });
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">
          Identidad y acceso
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Roles y permisos</h1>
        <p className="mt-2 text-slate-600">
          Define responsabilidades y controla las acciones disponibles para cada rol.
        </p>
      </header>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Roles</h2>
          {editingRole && (
            <button
              type="button"
              onClick={() => {
                setEditingRole(null);
                setRoleForm({ code: '', name: '', description: '' });
              }}
              className="text-sm font-semibold text-slate-500"
            >
              Cancelar edición
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_2fr_auto]">
          <ValidatedInput
            label="Código"
            value={roleForm.code}
            error={roleErrors.code}
            onChange={(value) => setRoleForm((form) => ({ ...form, code: value.toUpperCase() }))}
          />
          <ValidatedInput
            label="Nombre"
            value={roleForm.name}
            error={roleErrors.name}
            onChange={(value) => setRoleForm((form) => ({ ...form, name: value }))}
          />
          <ValidatedInput
            label="Descripción"
            value={roleForm.description}
            error={roleErrors.description}
            onChange={(value) => setRoleForm((form) => ({ ...form, description: value }))}
          />
          <Button type="button" onClick={submitRole} disabled={roleMutation.isPending}>
            {roleMutation.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {editingRole ? 'Guardar' : 'Crear rol'}
          </Button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {roles.data?.items
          .filter((role) => role.code !== 'ADMIN')
          .map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              permissions={
                permissions.data?.items.filter((permission) => permission.status !== 'INACTIVO') ??
                []
              }
              onEdit={() => {
                setEditingRole(role.id);
                setRoleForm({
                  code: role.code,
                  name: role.name,
                  description: role.description ?? '',
                });
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

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Catálogo de permisos</h2>
            <p className="text-sm text-slate-500">
              Crea, actualiza o elimina capacidades asignables.
            </p>
          </div>
          {editingPermission && (
            <button
              type="button"
              onClick={() => {
                setEditingPermission(null);
                setPermissionForm({ code: '', name: '', module: '', description: '' });
              }}
              className="text-sm font-semibold text-slate-500"
            >
              Cancelar edición
            </button>
          )}
        </div>
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_2fr_auto]">
            <ValidatedInput
              label="Código"
              value={permissionForm.code}
              error={permissionErrors.code}
              onChange={(value) =>
                setPermissionForm((form) => ({ ...form, code: value.toUpperCase() }))
              }
            />
            <ValidatedInput
              label="Nombre"
              value={permissionForm.name}
              error={permissionErrors.name}
              onChange={(value) => setPermissionForm((form) => ({ ...form, name: value }))}
            />
            <ValidatedInput
              label="Módulo"
              value={permissionForm.module}
              error={permissionErrors.module}
              onChange={(value) =>
                setPermissionForm((form) => ({ ...form, module: value.toUpperCase() }))
              }
            />
            <ValidatedInput
              label="Descripción"
              value={permissionForm.description}
              error={permissionErrors.description}
              onChange={(value) => setPermissionForm((form) => ({ ...form, description: value }))}
            />
            <Button
              type="button"
              onClick={submitPermission}
              disabled={permissionMutation.isPending}
            >
              {permissionMutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {editingPermission ? 'Guardar' : 'Crear'}
            </Button>
          </div>
          <div className="mt-5 divide-y rounded-2xl border">
            {permissions.data?.items.map((permission) => (
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
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPermission(permission.id);
                    setPermissionForm({
                      code: permission.code,
                      name: permission.name,
                      module: permission.module,
                      description: permission.description ?? '',
                    });
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"
                >
                  <Pencil className="size-4" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    confirmDelete === `permission-${permission.id}`
                      ? permissionMutation.mutate({ id: permission.id, method: 'DELETE' })
                      : setConfirmDelete(`permission-${permission.id}`)
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-red-700"
                >
                  <Trash2 className="size-4" />
                  {confirmDelete === `permission-${permission.id}` ? 'Confirmar' : 'Eliminar'}
                </button>
              </div>
            ))}
          </div>
        </>
      </section>
    </section>
  );
}

function RoleCard({
  role,
  permissions,
  onEdit,
  onDelete,
  confirmDelete,
}: {
  role: Role;
  permissions: Permission[];
  onEdit: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
}) {
  const client = useQueryClient();
  const [selected, setSelected] = useState(role.permissions.map((permission) => permission.id));
  const save = useMutation({
    mutationFn: () => write(`/roles/${role.id}/permissions`, 'PUT', { permissionIds: selected }),
    onSuccess: () => {
      toast.success(`Permisos de ${role.name} actualizados.`);
      void client.invalidateQueries({ queryKey: ['identity', 'roles'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
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
      <div className="mt-5 grid gap-2">
        {permissions.map((permission) => (
          <label
            key={permission.id}
            className="flex items-start gap-3 rounded-xl border p-3 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(permission.id)}
              onChange={(event) =>
                setSelected((items) =>
                  event.target.checked
                    ? [...items, permission.id]
                    : items.filter((id) => id !== permission.id),
                )
              }
              className="mt-1 size-4"
            />
            <span>
              <span className="text-sm font-bold text-slate-800">{permission.name}</span>
              <span className="block text-xs text-slate-500">
                {permission.module} · {permission.code}
              </span>
            </span>
          </label>
        ))}
      </div>
      {permissions.length > 0 && (
        <Button
          type="button"
          className="mt-5 w-full"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending && <LoaderCircle className="size-4 animate-spin" />} Guardar permisos
        </Button>
      )}
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
