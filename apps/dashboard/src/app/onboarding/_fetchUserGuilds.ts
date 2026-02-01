import { getDiscordAccountIdForUser } from "@repo/db/helpers/dashboard";
import { getBulkServers } from "@repo/db/helpers/servers";
import { getUserServers } from "@repo/db/helpers/user";
import { PermissionFlagsBits } from "discord-api-types/v8";

export type RawDiscordGuild = {
	id: string;
	name: string;
	icon: string;
	owner: boolean;
	permissions: number;
	alreadyAdded?: boolean;
};

export async function getGuilds(userId: string) {
	try {
		const userServers = await getUserServers(userId);
		const existingServers = await getBulkServers(
			userServers.map((us) => us.serverId),
		);

		const existingServerIdsSet = new Set(existingServers.map((s) => s.id));
		const finishedOnboardingServers = new Map<string, boolean>(
			userServers.map((us) => [us.serverId, us.finishedOnboarding]),
		);
		const accountData = await getDiscordAccountIdForUser(userId);

		if (!accountData?.accessToken) {
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

		const guilds: RawDiscordGuild[] = await response.json();
		return guilds
			.filter((guild) => {
				const permissions = BigInt(guild.permissions);
				return (
					(permissions & PermissionFlagsBits.ManageGuild) ===
					PermissionFlagsBits.ManageGuild
				);
			})
			.map((guild) => ({
				...guild,
				alreadyAdded:
					existingServerIdsSet.has(guild.id) &&
					finishedOnboardingServers.get(guild.id),
			}))
			.sort((a, b) => getPermissionRank(a) - getPermissionRank(b));
	} catch (err) {
		console.log(err);
		return { error: "Failed to fetch guilds" };
	}
}

function getPermissionRank(guild: RawDiscordGuild) {
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
