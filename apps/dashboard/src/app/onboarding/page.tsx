import { getDiscordAccountIdForUser } from '@repo/db/helpers/dashboard';
import { PermissionFlagsBits } from 'discord-api-types/v8';
import { unstable_cache } from 'next/cache';
import { OnboardingProvider } from '@/components/onboarding';
import { getCurrentUser } from '@/server/user';

const getGuildsCache = unstable_cache(getGuilds, ['userId'], {
  revalidate: 60,
});

export type Guild = {
  id: string;
  name: string;
  icon: string;
  owner: boolean;
  permissions: number;
};

async function getGuilds(userId: string) {
  const accountData = await getDiscordAccountIdForUser(userId);

  if (!accountData || !accountData.accessToken) {
    return { error: 'No discord account found' };
  }

  const response = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: {
      Authorization: `Bearer ${accountData.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return { error: 'Failed to fetch guilds' };
  }

  const guilds: Guild[] = await response.json();
  return guilds.filter((guild) => {
    const permissions = BigInt(guild.permissions);
    return (
      // biome-ignore lint/suspicious/noBitwiseOperators: <explanation>
      (permissions & PermissionFlagsBits.ManageGuild) ===
      PermissionFlagsBits.ManageGuild
    );
  }).sort((a, b) => {
    return getPermissionRank(a) - getPermissionRank(b);
  });
}

export default async function Page() {
  const { user } = await getCurrentUser();
  const guilds = await getGuildsCache(user.id);

  if ('error' in guilds) {
    return <div>Error: {guilds.error}</div>;
  }

  return (
    <div>
      <OnboardingProvider guilds={guilds} />
    </div>
  );
}

function getPermissionRank(guild: Guild) {
  if (guild.owner) {
    return 0;
  }

  if (
    (BigInt(guild.permissions) & PermissionFlagsBits.Administrator) ===
    PermissionFlagsBits.Administrator
  ) {
    return 1;
  }

  return 2;
}
