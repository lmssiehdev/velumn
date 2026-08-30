import { z } from "zod";

export const DISCORD_ARCHIVED_THREAD_PAGE_LIMIT = 100;
export const DISCORD_GUILD_PAGE_LIMIT = 200;
export const DISCORD_PERMANENT_INVITE_MAX_AGE_SECONDS = 0;
export const DISCORD_UNLIMITED_INVITE_MAX_USES = 0;
export const DISCORD_SNOWFLAKE_PATTERN = /^[0-9]{1,20}$/;
export const discordSnowflakeSchema = z
	.string()
	.regex(DISCORD_SNOWFLAKE_PATTERN);

export function isDiscordSnowflake(
	value: string | null | undefined,
): value is string {
	return discordSnowflakeSchema.safeParse(value).success;
}

export function getServerIcon(guild: { icon: string | null; id: string }) {
	const format = guild.icon?.startsWith("a_") ? "gif" : "png";

	return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${format}?size={64}`;
}

export function constructDiscordLink({
	serverId,
	threadId,
	messageId,
}: {
	serverId: string;
	threadId: string;
	messageId?: string;
}) {
	const parts = [serverId, threadId];

	if (messageId) {
		parts.push(messageId);
	}

	return `https://discord.com/channels/${parts.join("/")}`;
}
