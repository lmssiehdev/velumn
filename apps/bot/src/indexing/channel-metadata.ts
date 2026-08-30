import type { IndexingChannelMetadataInput } from "@repo/db/helpers/indexing";
import { ChannelFlags, ChannelType, type GuildBasedChannel } from "discord.js";

export interface IndexingChannelMetadataFacts {
	readonly observedAt: Date;
	readonly position: number;
	readonly botPermissions: bigint | null;
	readonly botPermissionsCheckedAt: Date | null;
}

export const toIndexingChannelMetadata = (
	channel: GuildBasedChannel,
	facts: IndexingChannelMetadataFacts,
): IndexingChannelMetadataInput & { readonly pinned: boolean } => ({
	id: channel.id,
	serverId: channel.guildId,
	parentId: channel.parentId,
	authorId: channel.isThread() ? (channel.ownerId ?? null) : null,
	channelName: "name" in channel ? channel.name : null,
	position: facts.position,
	nsfw: "nsfw" in channel ? channel.nsfw : false,
	botPermissions: facts.botPermissions?.toString() ?? null,
	botPermissionsCheckedAt: facts.botPermissionsCheckedAt,
	observedAt: facts.observedAt,
	archived: channel.isThread() ? (channel.archived ?? false) : false,
	locked: channel.isThread() ? (channel.locked ?? false) : false,
	pinned: channel.flags?.has(ChannelFlags.Pinned) ?? false,
	archivedTimestamp: channel.isThread() ? channel.archiveTimestamp : null,
	type: channel.type,
	availableTags:
		channel.type === ChannelType.GuildForum
			? {
					_tag: "Replace",
					items: (channel.availableTags ?? []).map((tag) => ({
						id: tag.id,
						name: tag.name,
						moderated: tag.moderated,
						emojiId: tag.emoji?.id ?? null,
						emojiName: tag.emoji?.name ?? null,
					})),
				}
			: { _tag: "NotFetched" },
	appliedTagIds: channel.isThread()
		? { _tag: "Replace", items: channel.appliedTags }
		: { _tag: "NotFetched" },
});
