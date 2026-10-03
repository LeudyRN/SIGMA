import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './button';

export function TableActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-max flex-nowrap items-center gap-2 whitespace-nowrap">{children}</div>
  );
}

export function TableActionButton({
  label,
  children,
  className,
  variant = 'outline',
  ...props
}: Omit<ButtonProps, 'size'> & { label: string }) {
  return (
    <Button
      type="button"
      variant={variant}
      aria-label={label}
      title={label}
      {...props}
      className={cn('size-11 p-0', className)}
    >
      {children}
    </Button>
  );
}
