import {
	deleteChannel,
	findChannelById,
	upsertChannel,
} from "@repo/db/helpers/channels";
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

@ApplyOptions<Listener.Options>({
	event: Events.ChannelDelete,
	name: "delete-channel",
})
export class DeleteChannel extends Listener {
	async run(channel: Channel) {
		try {
			await deleteChannel(channel.id);
			// TODO: figure out what to do here
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
				await invalidateTags(CacheTags.thread(thread.id));
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

			const { id, channelName, pinned } = channelToUpdate;

			const result = await upsertChannel({
				create: channelToUpdate,
				update: { id, channelName, pinned },
			});

			if (result.rowCount) {
				updateSearchThread({
					threadId: newThread.id,
					threadTitle: channelName!,
				});
				await invalidateTags(CacheTags.thread(newThread.id));
			}
		} catch (error) {
			this.container.logger.error("Failed to update thread", error);
		}
	}
}
