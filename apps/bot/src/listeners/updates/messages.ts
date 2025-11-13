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
	type Snowflake,
} from "discord.js";
import { toDBMessage } from "../../helpers/convertion";
import { invalidateTags } from "../../helpers/invalidate-cache";

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
			await invalidateTags(CacheTags.thread(message.channel.id));
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
				await invalidateTags(CacheTags.thread(message.channel.id));
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
			const messagesInThreadsIds = messages
				.filter((m) => m.channel.isThread())
				.map((m) => m.id);
			await deleteManyMessagesById(messagesInThreadsIds);
			// TODO: invalidate cache
		} catch (error) {
			this.container.logger.error("Failed to delete messages", error);
		}
	}
}
