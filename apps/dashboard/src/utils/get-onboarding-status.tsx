import {
	checkIfServerExistsForUser,
	getOnboardingLifecycleForUser,
} from "@repo/db/helpers/servers";
import type { DBServer } from "@repo/db/schema/discord";
import type { RawDiscordGuild } from "@/app/onboarding/_fetchUserGuilds";
import { getGuildsCache } from "@/cache";

export async function getOnboardingStatus({
	userId,
	serverId,
	options,
}: {
	userId: string;
	serverId: string;
	options?: {
		skipDBCheck?: boolean;
	};
}): Promise<
	| {
			readonly status: "inviting-bot" | "selecting-channels";
	  }
	| {
			readonly status: "onboarding";
			reason: "user_has_no_permissions" | "server_not_found_in_db";
	  }
	| {
			readonly status: "finished";
			server: DBServer;
	  }
> {
	const userHasPermissions = await checkIfUserHasPermissionsForServerFromApi(
		userId,
		serverId,
	);

	if (!userHasPermissions) {
		return { status: "onboarding", reason: "user_has_no_permissions" };
	}

	if (options?.skipDBCheck) {
		return { status: "inviting-bot" };
	}

	const lifecycle = await getOnboardingLifecycleForUser({ userId, serverId });
	if (lifecycle === "invite_required") {
		return { status: "onboarding", reason: "server_not_found_in_db" };
	}
	if (lifecycle === "waiting_for_bot") return { status: "inviting-bot" };
	if (lifecycle === "select_channels") return { status: "selecting-channels" };

	const userServer = await checkIfServerExistsForUser({ userId, serverId });
	if (!userServer?.server) {
		return { status: "onboarding", reason: "server_not_found_in_db" };
	}

	return { status: "finished", server: userServer.server };
}

export async function checkIfUserHasPermissionsForServerFromApi(
	userId: string,
	serverId: string,
) {
	// Check if user has permissions for this server
	const guildsThatUserHasPermissionsIn = await getGuildsCache(userId);

	// Handle error case from cache
	if (
		typeof guildsThatUserHasPermissionsIn === "object" &&
		"error" in guildsThatUserHasPermissionsIn
	) {
		return false;
	}

	const guildsIdsSet = new Set(
		guildsThatUserHasPermissionsIn.map((g: RawDiscordGuild) => g.id),
	);

	if (guildsIdsSet.size === 0 || !guildsIdsSet.has(serverId)) {
		return false;
	}

	return true;
}
