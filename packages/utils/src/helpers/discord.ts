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
