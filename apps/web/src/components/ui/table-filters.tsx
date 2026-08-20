'use client';

import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';

interface TableFiltersProps {
  children?: ReactNode;
  hasActiveFilters?: boolean;
  onClear?: () => void;
  onSearchChange: (value: string) => void;
  search: string;
  searchPlaceholder?: string;
  totalLabel?: string;
}

export function TableFilters({
  children,
  hasActiveFilters,
  onClear,
  onSearchChange,
  search,
  searchPlaceholder = 'Buscar…',
  totalLabel,
}: TableFiltersProps) {
  return (
    <div className="border-b bg-slate-50/70 p-3 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Search aria-hidden="true" className="size-3.5" /> Buscar
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </label>
        {children && (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:items-end">
            {children}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 xl:pb-0.5">
          {onClear && (
            <Button
              type="button"
              variant="outline"
              onClick={onClear}
              disabled={!hasActiveFilters}
              className="h-10"
            >
              <RotateCcw aria-hidden="true" className="size-4" /> Limpiar
            </Button>
          )}
          {totalLabel && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap text-slate-500">
              <SlidersHorizontal aria-hidden="true" className="size-4" /> {totalLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-40 rounded-xl border bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
