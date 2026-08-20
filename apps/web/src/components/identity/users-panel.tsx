'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Plus, Trash2, UserRoundCog } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { EntityDialog } from '@/components/ui/entity-dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { FilterSelect, TableFilters } from '@/components/ui/table-filters';
import { apiFetch, readApiError } from '@/lib/api';

interface Role {
  id: string;
  code: string;
  name: string;
  status?: string;
}

interface UserItem {
  id: string;
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  status: string;
  lastAccessAt: string | null;
  roles: Role[];
}

const userSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(1, 'El código de empleado es obligatorio.')
    .regex(/^[A-Za-z0-9-]{3,30}$/, 'Usa entre 3 y 30 letras, números o guiones.'),
  firstName: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(120),
  lastName: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(120),
  email: z.string().trim().email('Escribe un correo válido.').max(190),
  password: z.string().max(128, 'La contraseña es demasiado larga.'),
  roleId: z.string().min(1, 'Selecciona un rol.'),
});

type UserFormValues = z.infer<typeof userSchema>;

async function getJson<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<T>;
}

export function UsersPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      roleId: '',
    },
  });

  const users = useQuery({
    queryKey: ['identity', 'users', search],
    queryFn: () =>
      getJson<{ items: UserItem[]; total: number }>(
        `/users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
  const roles = useQuery({
    queryKey: ['identity', 'roles'],
    queryFn: () => getJson<{ items: Role[] }>('/roles'),
  });
  const activeRoles =
    roles.data?.items.filter(
      (role) => role.status !== 'INACTIVO' && !['ADMIN', 'ESTUDIANTE'].includes(role.code),
    ) ?? [];
  const filteredUsers =
    users.data?.items.filter(
      (user) =>
        (!roleFilter || user.roles.some((role) => role.id === roleFilter)) &&
        (!statusFilter || user.status === statusFilter),
    ) ?? [];
  const pagination = usePagination(filteredUsers);

  const saveUser = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (!editing && values.password.length < 12) {
        throw new Error('La contraseña inicial debe tener al menos 12 caracteres.');
      }
      const userBody = {
        employeeCode: values.employeeCode.trim().toUpperCase(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim().toLowerCase(),
        ...((!editing || values.password) && { password: values.password }),
        ...(!editing && { roleIds: [values.roleId] }),
      };
      const response = await apiFetch(editing ? `/users/${editing.id}` : '/users', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(userBody),
      });
      if (!response.ok) throw new Error(await readApiError(response));

      if (editing && editing.roles[0]?.id !== values.roleId) {
        const roleResponse = await apiFetch(`/users/${editing.id}/roles`, {
          method: 'PUT',
          body: JSON.stringify({ roleIds: [values.roleId] }),
        });
        if (!roleResponse.ok) throw new Error(await readApiError(roleResponse));
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Usuario actualizado.' : 'Usuario creado.');
      closeForm();
      void queryClient.invalidateQueries({ queryKey: ['identity', 'users'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateUser = useMutation({
    mutationFn: async ({
      id,
      path = '',
      body,
      method = 'PATCH',
    }: {
      id: string;
      path?: string;
      body: unknown;
      method?: 'PATCH' | 'PUT';
    }) => {
      const response = await apiFetch(`/users/${id}${path}`, {
        method,
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await readApiError(response));
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'users'] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const removeUser = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response));
    },
    onSuccess: () => {
      setConfirmDelete(null);
      toast.success('Usuario eliminado.');
      void queryClient.invalidateQueries({ queryKey: ['identity', 'users'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      employeeCode: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      roleId: '',
    });
    setFormOpen(true);
  }

  function openEdit(user: UserItem) {
    setEditing(user);
    form.reset({
      employeeCode: user.employeeCode ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      roleId: user.roles[0]?.id ?? '',
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    form.clearErrors();
  }

  function submitUser(values: UserFormValues) {
    if (!editing && values.password.length < 12) {
      form.setError('password', {
        message: 'La contraseña inicial debe tener al menos 12 caracteres.',
      });
      return;
    }
    saveUser.mutate(values);
  }

  return (
    <section className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">
            Identidad y acceso
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Usuarios</h1>
          <p className="mt-2 text-slate-600">
            Administra las cuentas del personal docente, sus códigos de empleado, roles y estado de
            acceso.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" /> Crear usuario
        </Button>
      </div>

      <EntityDialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        description="Completa los datos reales de la cuenta institucional y asigna su rol operativo."
        size="lg"
      >
        <form onSubmit={form.handleSubmit(submitUser)} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Código de empleado" error={form.formState.errors.employeeCode?.message}>
              <input
                {...form.register('employeeCode')}
                autoComplete="off"
                className="h-11 rounded-xl border px-3 font-normal uppercase"
              />
            </Field>
            <Field label="Nombres" error={form.formState.errors.firstName?.message}>
              <input
                {...form.register('firstName')}
                className="h-11 rounded-xl border px-3 font-normal"
              />
            </Field>
            <Field label="Apellidos" error={form.formState.errors.lastName?.message}>
              <input
                {...form.register('lastName')}
                className="h-11 rounded-xl border px-3 font-normal"
              />
            </Field>
            <Field label="Correo institucional" error={form.formState.errors.email?.message}>
              <input
                {...form.register('email')}
                type="email"
                className="h-11 rounded-xl border px-3 font-normal"
              />
            </Field>
            <Field
              label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
              error={form.formState.errors.password?.message}
            >
              <input
                {...form.register('password')}
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-xl border px-3 font-normal"
              />
            </Field>
            <Field label="Rol" error={form.formState.errors.roleId?.message}>
              <select
                {...form.register('roleId')}
                className="h-11 rounded-xl border bg-white px-3 font-normal"
              >
                <option value="">Selecciona un rol</option>
                {activeRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveUser.isPending}>
              {saveUser.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </EntityDialog>

      <div className="min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
        <TableFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Nombre, correo o código de empleado"
          totalLabel={`${filteredUsers.length} usuarios`}
          hasActiveFilters={Boolean(search || roleFilter || statusFilter)}
          onClear={() => {
            setSearch('');
            setRoleFilter('');
            setStatusFilter('');
          }}
        >
          <FilterSelect
            label="Rol"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: '', label: 'Todos los roles' },
              ...activeRoles.map((role) => ({ value: role.id, label: role.name })),
            ]}
          />
          <FilterSelect
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'ACTIVO', label: 'Activo' },
              { value: 'INACTIVO', label: 'Inactivo' },
              { value: 'BLOQUEADO', label: 'Bloqueado' },
              { value: 'PENDIENTE', label: 'Pendiente' },
            ]}
          />
        </TableFilters>
        <div className="responsive-table max-w-full overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="p-4">Usuario</th>
                <th className="p-4">Código</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Último acceso</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((user) => (
                <tr key={user.id} className="border-t align-middle">
                  <td className="p-4">
                    <p className="font-bold text-slate-900">{user.name}</p>
                    <p className="text-slate-500">{user.email}</p>
                  </td>
                  <td className="p-4 font-semibold">{user.employeeCode ?? 'Pendiente'}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                      {user.roles[0]?.name ?? 'Sin rol'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">
                      {user.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">
                    {user.lastAccessAt
                      ? new Intl.DateTimeFormat('es-DO', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(user.lastAccessAt))
                      : 'Nunca'}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"
                      >
                        <Pencil className="size-4" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateUser.mutate({
                            id: user.id,
                            body: { status: user.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' },
                          })
                        }
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-700"
                      >
                        <UserRoundCog className="size-4" />
                        {user.status === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                      </button>
                      {confirmDelete === user.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => removeUser.mutate(user.id)}
                            className="text-xs font-bold text-red-700"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs font-bold text-slate-500"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(user.id)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-700"
                        >
                          <Trash2 className="size-4" /> Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.isLoading && <p className="p-8 text-center text-slate-500">Cargando usuarios…</p>}
          {users.isError && (
            <p className="p-8 text-center text-red-700">No fue posible cargar los usuarios.</p>
          )}
        </div>
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={filteredUsers.length}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      {children}
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}
