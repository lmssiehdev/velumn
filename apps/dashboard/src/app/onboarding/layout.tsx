import { AuthProvider, Providers } from '@/app/providers';
import { getCurrentUserOrRedirect } from '@/server/user';
import { redirect } from 'next/navigation';
import { getGuildsCache } from './_fetchUserGuilds';
import { getChannelsInServer } from '@repo/db/helpers/servers';
import { OnboardingProvider } from './page';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getCurrentUserOrRedirect();

  if ( user.finishedOnboarding ) {
    redirect("/")
  }

  const guilds = await getGuildsCache(user.id);

  if ('error' in guilds) {
    return <div>Error: {guilds.error}</div>;
  }

  const initialChannels = await getChannelsInServer(user.serverId!) ?? [];

  return (
    <div>
      <AuthProvider user={user}>
        <Providers>
          <OnboardingProvider guilds={guilds} initialGuildId={user.serverId ?? null} initialChannels={initialChannels}>
            {children}
          </OnboardingProvider>
          </Providers>
      </AuthProvider>
    </div>
  );
}
