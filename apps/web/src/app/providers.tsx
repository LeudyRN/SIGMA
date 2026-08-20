'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ApiError, isAuthenticationError } from '@/lib/api';

function retryTransientQuery(failureCount: number, error: unknown): boolean {
  if (isAuthenticationError(error)) return false;

  if (error instanceof ApiError && error.status !== null && error.status < 500) {
    return false;
  }

  return failureCount < 3;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnReconnect: true,
            refetchOnWindowFocus: true,
            retry: retryTransientQuery,
            retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 5_000),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}

      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
