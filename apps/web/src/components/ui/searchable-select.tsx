'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

interface SearchableOption {
  label: string;
  searchText?: string;
  value: string;
}

interface SearchableSelectProps {
  disabled?: boolean;
  emptyMessage?: string;
  label: string;
  onChange: (value: string) => void;
  onSearchChange?: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

export function SearchableSelect({
  disabled = false,
  emptyMessage = 'No se encontraron opciones.',
  label,
  onChange,
  onSearchChange,
  options,
  placeholder = 'Seleccionar',
  searchPlaceholder = 'Escribe para buscar',
  value,
}: SearchableSelectProps) {
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = normalize(query);
  const filteredOptions = useMemo(
    () =>
      options.filter((option) =>
        normalize(`${option.label} ${option.searchText ?? ''}`).includes(normalizedQuery),
      ),
    [normalizedQuery, options],
  );

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) setPosition({ left: rect.left, top: rect.bottom + 6, width: rect.width });
    };
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    updatePosition();
    document.addEventListener('mousedown', closeOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  function select(option: SearchableOption) {
    onChange(option.value);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) =>
        filteredOptions.length
          ? (current + direction + filteredOptions.length) % filteredOptions.length
          : 0,
      );
      return;
    }
    if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
      event.preventDefault();
      select(filteredOptions[activeIndex]);
    }
  }

  return (
    <div ref={rootRef} className="relative grid min-w-0 gap-1 text-xs font-bold text-slate-600">
      <label htmlFor={inputId}>{label}</label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : (selected?.label ?? '')}
          placeholder={open ? searchPlaceholder : placeholder}
          onFocus={() => {
            setQuery('');
            setActiveIndex(0);
            setOpen(true);
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setActiveIndex(0);
            setOpen(true);
            onSearchChange?.(nextQuery);
            if (!nextQuery) onChange('');
          }}
          onKeyDown={handleKeyDown}
          className="h-11 w-full rounded-xl border bg-white pr-10 pl-9 text-sm font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400"
        />
      </div>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              style={{ left: position.left, top: position.top, width: position.width }}
              className="fixed z-[150] max-h-72 overflow-y-auto rounded-xl border bg-white p-1.5 text-sm font-normal text-slate-900 shadow-xl"
            >
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-slate-500">{emptyMessage}</p>
              ) : (
                filteredOptions.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(option)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      index === activeIndex ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.value === value && (
                      <Check aria-hidden="true" className="size-4 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
