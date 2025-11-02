import { cookies, headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { cache } from 'react';
import { appRouter } from './root';

export async function createContext() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    return {
      session,
      user: session?.user || null,
    };
  } catch (_error) {
    return {
      session: null,
      user: null,
    };
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>;