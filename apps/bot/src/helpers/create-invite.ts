import { logger } from "@repo/logger";
import {
	DISCORD_PERMANENT_INVITE_MAX_AGE_SECONDS,
	DISCORD_UNLIMITED_INVITE_MAX_USES,
} from "@repo/utils/helpers/discord";
import type { Guild } from "discord.js";

export async function createServerInvite(guild: Guild) {
	const vanityURLCode = guild.vanityURLCode;
	if (vanityURLCode) {
		return vanityURLCode;
	}

	try {
		const channel =
			guild.systemChannel ||
			guild.rulesChannel ||
			guild.channels.cache.find(
				(ch) =>
					ch.isTextBased() &&
					ch.permissionsFor(guild.members.me!)?.has("CreateInstantInvite"),
			);

		if (channel) {
			const invite = await guild.invites.create(channel.id, {
				maxAge: DISCORD_PERMANENT_INVITE_MAX_AGE_SECONDS,
				maxUses: DISCORD_UNLIMITED_INVITE_MAX_USES,
				unique: false,
				reason: "used by velumn.com",
			});

			return invite.code;
		}

		// we check for existing invites first
		const existingInvites = await guild.invites.fetch();
		const permanentInvite = existingInvites.find(
			(invite) =>
				invite.maxAge === DISCORD_PERMANENT_INVITE_MAX_AGE_SECONDS &&
				invite.maxUses === DISCORD_UNLIMITED_INVITE_MAX_USES,
		);

		logger.error("No suitable channel found to create invite", {
			guildId: guild.id,
			guildName: guild.name,
		});

		if (permanentInvite) {
			return permanentInvite.url;
		}
		return;
	} catch (error) {
		logger.error("Failed to create invite", {
			error,
			guildId: guild.id,
			guildName: guild.name,
		});
		return;
	}
}
