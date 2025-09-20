import { getDiscordAccountIdForUser } from "@repo/db/helpers/dashboard";
import { PermissionFlagsBits } from "discord-api-types/v8";
import { unstable_cache } from "next/cache";
import { OnboardingWrapper } from "@/components/onboarding";
import { getCurrentUser } from "@/server/user";

const getGuildsCache = unstable_cache(getGuilds, ["userId"], {
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
    return { error: "No discord account found" };
  }

  const response = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: {
      Authorization: `Bearer ${accountData.accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return { error: "Failed to fetch guilds" };
  }

  const guilds: Guild[] = await response.json();
  return guilds.filter((guild) => {
    const permissions = BigInt(guild.permissions);
    return (
      (permissions & PermissionFlagsBits.ManageGuild) ===
      PermissionFlagsBits.ManageGuild
    );
  });
}

export default async function Page() {
  const { user } = await getCurrentUser();
  const guilds = await getGuildsCache(user.id);

  if ("error" in guilds) {
    return <div>Error: {guilds.error}</div>;
  }

  return (
    <div>
      <OnboardingWrapper guilds={guilds} />
    </div>
  );
}
