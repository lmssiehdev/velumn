import {
	deleteManyMessagesById,
	deleteMesasgeById,
	getMessageById,
	updateMessage,
} from "@repo/db/helpers/messages";
import { ApplyOptions } from "@sapphire/decorators";
import { Listener } from "@sapphire/framework";
import {
	type Collection,
	Events,
	type Message,
	type Snowflake,
} from "discord.js";
import { toDBMessage } from "../../helpers/convertion";

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
			const exsting = await getMessageById(newMessage.id);
			if (!exsting) {
				return;
			}
			const converted = await toDBMessage(newMessage);
			await updateMessage(converted);
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
			await deleteMesasgeById(message.id);
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
		} catch (error) {
			this.container.logger.error("Failed to delete messages", error);
		}
	}
}
