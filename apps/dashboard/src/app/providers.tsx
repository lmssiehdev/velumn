'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { User } from 'better-auth';
import { createContext, useContext, useMemo, useState } from 'react';
import type { AuthUser } from '@/lib/auth';
import { TRPCProvider } from '@/lib/trpc';
import type { AppRouter } from '@/server/trpc/root';
import * as React from 'react';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        // biome-ignore lint/style/noMagicNumbers: <explanation>
        staleTime: 60 * 1000,
      },
    },
  });
}
let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}

const AuthContext = createContext<{ user: AuthUser }>({} as { user: AuthUser });

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return context;
}

export function AuthProvider({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ user }), [user?.id]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
