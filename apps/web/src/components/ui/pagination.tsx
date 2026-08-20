'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from './button';

export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [currentPage, items, pageSize]);

  return { page: currentPage, pageCount, pageItems, pageSize, setPage, setPageSize };
}

interface PaginationProps {
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  page: number;
  pageSize: number;
  pageSizes?: number[];
  total: number;
}

export function Pagination({
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizes = [10, 20, 50],
  total,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-center text-xs font-semibold text-slate-500 sm:text-left">
        Mostrando {first}–{last} de {total}
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Filas
          <select
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
              onPageChange(1);
            }}
            className="h-9 rounded-lg border bg-white px-2"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="size-9"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
        <span className="min-w-20 text-center text-xs font-bold text-slate-700">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Página siguiente"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="size-9"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}
