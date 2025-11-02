import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { cache } from 'react';
import { getServerInfo } from '@repo/db/helpers/servers';

export const getSession = cache(async () => {
  return await auth.api.getSession({
    headers: await headers(),
  });
});

export const getCurrentUserOrRedirect = cache(async () => {
  const session = await getSession();

  if (!session) {
    redirect('/auth/sign-in');
  }

  return {
    ...session,
  };
});

export const getUserServer = cache(async (serverId: string) => {
  return await getServerInfo(serverId)
})
