import {
	deleteChannel,
	findChannelById,
	upsertChannel,
} from "@repo/db/helpers/channels";
import type { DBChannel } from "@repo/db/schema/discord";
import { CacheTags } from "@repo/utils/helpers/cache-keys";
import { ApplyOptions } from "@sapphire/decorators";
import { Listener } from "@sapphire/framework";
import {
	type Channel,
	ChannelType,
	Events,
	type GuildChannel,
	type PublicThreadChannel,
	type ThreadChannel,
} from "discord.js";
import { toDbChannel } from "../../helpers/convertion";
import { invalidateTags } from "../../helpers/invalidate-cache";
import { indexThread } from "../../indexing/channel";
import { deleteSearchThread, updateSearchThread } from "../../indexing/search";

function getBoardTags(channel: Pick<DBChannel, "id" | "serverId">) {
	return [
		CacheTags.channelInfo(channel.id),
		CacheTags.topicsInServer(channel.serverId),
		CacheTags.getAllThreads(channel.serverId),
	];
}

function getThreadTags({
	threadId,
	parentChannelId,
	guildId,
}: {
	threadId: string;
	parentChannelId?: string | null;
	guildId?: string | null;
}) {
	return [
		CacheTags.thread(threadId),
		parentChannelId ? CacheTags.getAllThreads(parentChannelId) : null,
		guildId ? CacheTags.getAllThreads(guildId) : null,
		guildId ? CacheTags.topicsInServer(guildId) : null,
	].filter((tag): tag is string => tag !== null);
}

@ApplyOptions<Listener.Options>({
	event: Events.ChannelDelete,
	name: "delete-channel",
})
export class DeleteChannel extends Listener {
	async run(channel: Channel) {
		try {
			const existingChannel = await findChannelById(channel.id);
			const result = await deleteChannel(channel.id);

			if (!result.rowCount || !existingChannel || existingChannel.parentId) {
				return;
			}

			await invalidateTags(getBoardTags(existingChannel));
		} catch (error) {
			this.container.logger.error("Failed to delete channel", error);
		}
	}
}

@ApplyOptions<Listener.Options>({
	event: Events.ChannelUpdate,
	name: "update-channel",
})
export class UpdateChannel extends Listener {
	async run(_: GuildChannel, newChannel: GuildChannel) {
		try {
			const channel = await findChannelById(newChannel.id);
			if (!channel) {
				return;
			}
			await upsertChannel({
				create: channel,
				update: {
					id: newChannel.id,
					channelName: newChannel.name,
				},
			});
			await invalidateTags(getBoardTags(channel));
		} catch (error) {
			this.container.logger.error("Failed to update channel", error);
		}
	}
}

//
// Threads
//
@ApplyOptions<Listener.Options>({
	event: Events.ThreadCreate,
	name: "create-thread",
})
export class ThreadCreate extends Listener {
	async run(thread: ThreadChannel) {
		try {
			if (thread.type !== ChannelType.PublicThread) {
				console.log("Thread is not a public thread");
				return;
			}

			// @hacky: from what i remember discord sends seperate messages for the thread and the message, this is an easy work around that works well
			setTimeout(async () => {
				await indexThread(thread as PublicThreadChannel);
				await invalidateTags(
					getThreadTags({
						threadId: thread.id,
						parentChannelId: thread.parentId,
						guildId: thread.guildId,
					}),
				);
			}, 5000);
		} catch (error) {
			this.container.logger.error("Failed to create channel", error);
		}
	}
}

@ApplyOptions<Listener.Options>({
	event: Events.ThreadDelete,
	name: "delete-thread",
})
export class ThreadDelete extends Listener {
	async run(thread: ThreadChannel) {
		try {
			const result = await deleteChannel(thread.id);
			if (result.rowCount) {
				await invalidateTags(
					getThreadTags({
						threadId: thread.id,
						parentChannelId: thread.parentId,
						guildId: thread.guildId,
					}),
				);
				await deleteSearchThread({ id: thread.id });
			}
		} catch (error) {
			this.container.logger.error("Failed to delete thread", error);
		}
	}
}

@ApplyOptions<Listener.Options>({
	event: Events.ThreadUpdate,
	name: "update-thread",
})
export class UpdateThread extends Listener {
	async run(_: GuildChannel, newThread: ThreadChannel) {
		try {
			const channelToUpdate = await toDbChannel(newThread);

			const { id, authorId, channelName, pinned } = channelToUpdate;

			const result = await upsertChannel({
				create: channelToUpdate,
				update: { id, authorId, channelName, pinned },
			});

			if (result.rowCount) {
				updateSearchThread({
					threadId: newThread.id,
					threadTitle: channelName!,
				});
				await invalidateTags(
					getThreadTags({
						threadId: newThread.id,
						parentChannelId: newThread.parentId,
						guildId: newThread.guildId,
					}),
				);
			}
		} catch (error) {
			this.container.logger.error("Failed to update thread", error);
		}
	}
}
