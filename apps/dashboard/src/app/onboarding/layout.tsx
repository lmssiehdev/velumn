import { getChannelsInServer } from '@repo/db/helpers/servers';
import { redirect } from 'next/navigation';
import { AuthProvider, Providers } from '@/app/providers';
import { getCurrentUserOrRedirect } from '@/server/user';
import { getGuildsCache } from './_fetchUserGuilds';
import { OnboardingProvider } from './page';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getCurrentUserOrRedirect();

  if (user?.finishedOnboarding) {
    redirect('/');
  }

  const guilds = await getGuildsCache(user.id);

  if ('error' in guilds) {
    return <div>Error: {guilds.error}</div>;
  }

  const channels = await getChannelsInServer(user.serverId!);
  const initialChannels = channels.map((c) => ({
    ...c,
    enabled: c.indexingEnabled,
  }));

  return (
    <div>
      <AuthProvider user={user}>
        <Providers>
          <OnboardingProvider
            guilds={guilds}
            initialChannels={initialChannels}
            initialGuildId={user.serverId ?? null}
          />
        </Providers>
      </AuthProvider>
    </div>
  );
}
