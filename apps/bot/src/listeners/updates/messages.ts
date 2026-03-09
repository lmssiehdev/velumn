import { findChannelById } from "@repo/db/helpers/channels";
import {
	deleteManyMessagesById,
	deleteMessageById,
	updateMessage,
	upsertManyMessages,
} from "@repo/db/helpers/messages";
import { CacheTags } from "@repo/utils/helpers/cache-keys";
import { ApplyOptions } from "@sapphire/decorators";
import { Listener } from "@sapphire/framework";
import {
	type Collection,
	Events,
	type Message,
	type PublicThreadChannel,
	type Snowflake,
} from "discord.js";
import { toDBMessage } from "../../helpers/convertion";
import { invalidateTags } from "../../helpers/invalidate-cache";
import {
	deleteMessagesFromSearch,
	insertBulkSearchMessages,
} from "../../indexing/search";

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
	].filter((tag): tag is string => tag !== null);
}

@ApplyOptions<Listener.Options>({
	event: Events.MessageCreate,
	name: "create-message",
})
export class InsertDiscordMessage extends Listener {
	async run(message: Message) {
		try {
			if (!message.channel.isThread()) {
				return;
			}
			const existing = await findChannelById(message.channel.id);
			if (!existing) {
				return;
			}
			const converted = await toDBMessage(message);
			await upsertManyMessages([converted]);
			const thread = message.channel as PublicThreadChannel;
			insertBulkSearchMessages(thread, [converted]);
			await invalidateTags(
				getThreadTags({
					threadId: message.channel.id,
					parentChannelId: existing.parentId,
					guildId: existing.serverId,
				}),
			);
		} catch (error) {
			this.container.logger.error("Failed to update message", error);
		}
	}
}

@ApplyOptions<Listener.Options>({
	event: Events.MessageUpdate,
	name: "update-message",
})
export class UpdateDiscordMessage extends Listener {
	async run(_oldMessage: Message, newMessage: Message) {
		try {
			if (!newMessage.channel.isThread()) {
				return;
			}
			const converted = await toDBMessage(newMessage);
			const result = await updateMessage(converted);
			if (result.rowCount) {
				const thread = newMessage.channel as PublicThreadChannel;
				insertBulkSearchMessages(thread, [converted]);
				await invalidateTags(CacheTags.thread(newMessage.channel.id));
			}
		} catch (error) {
			this.container.logger.error("Failed to update message", error);
		}
	}
}

@ApplyOptions<Listener.Options>({
	event: Events.MessageDelete,
	name: "delete-message",
})
export class DeleteDiscordMessage extends Listener {
	async run(message: Message) {
		try {
			if (!message.channel.isThread()) {
				return;
			}
			const result = await deleteMessageById(message.id);
			if (result.rowCount) {
				await deleteMessagesFromSearch([message.id]);
				const thread = message.channel as PublicThreadChannel;
				await invalidateTags(
					getThreadTags({
						threadId: thread.id,
						parentChannelId: thread.parentId,
						guildId: message.guildId,
					}),
				);
			}
		} catch (error) {
			this.container.logger.error("Failed to delete message", error);
		}
	}
}

@ApplyOptions<Listener.Options>({
	event: Events.MessageBulkDelete,
	name: "bulk-delete-messages",
})
export class BulkDeleteDiscordMessage extends Listener {
	async run(messages: Collection<Snowflake, Message>) {
		try {
			const threadMessages = messages.filter((m) => m.channel.isThread());
			const messagesInThreadsIds = threadMessages.map((m) => m.id);
			const result = await deleteManyMessagesById(messagesInThreadsIds);

			if (result?.rowCount) {
				await deleteMessagesFromSearch(messagesInThreadsIds);
				const tags = new Set<string>();

				for (const message of threadMessages.values()) {
					const thread = message.channel as PublicThreadChannel;
					for (const tag of getThreadTags({
						threadId: thread.id,
						parentChannelId: thread.parentId,
						guildId: message.guildId,
					})) {
						tags.add(tag);
					}
				}

				if (tags.size > 0) {
					await invalidateTags([...tags]);
				}
			}
		} catch (error) {
			this.container.logger.error("Failed to delete messages", error);
		}
	}
}
