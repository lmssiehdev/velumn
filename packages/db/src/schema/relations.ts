import { defineRelations } from "drizzle-orm";
import * as schema from "../schema";

export const relations = defineRelations(schema, (r) => ({
	account: {
		user: r.one.user({
			from: r.account.userId,
			to: r.user.id,
		}),
	},
	user: {
		accounts: r.many.account(),
		sessions: r.many.session(),
	},
	session: {
		user: r.one.user({
			from: r.session.userId,
			to: r.user.id,
		}),
	},
	dbServer: {
		channels: r.many.dbChannel(),
	},
	dbChannel: {
		backlinks: r.many.dbThreadBacklink({
			from: r.dbChannel.id,
			to: r.dbThreadBacklink.toThreadId,
		}),
		parent: r.one.dbChannel({
			from: r.dbChannel.parentId,
			to: r.dbChannel.id,
		}),
		author: r.one.dbDiscordUser({
			from: r.dbChannel.authorId,
			to: r.dbDiscordUser.id,
		}),
		server: r.one.dbServer({
			from: r.dbChannel.serverId,
			to: r.dbServer.id,
		}),
		messages: r.many.dbMessage(),
	},
	dbMessage: {
		channel: r.one.dbChannel({
			from: r.dbMessage.primaryChannelId,
			to: r.dbChannel.id,
		}),
		user: r.one.dbDiscordUser({
			from: r.dbMessage.authorId,
			to: r.dbDiscordUser.id,
		}),
		attachments: r.many.dbAttachments(),
	},
	dbAttachments: {
		message: r.one.dbMessage({
			from: r.dbAttachments.messageId,
			to: r.dbMessage.id,
		}),
	},
	dbThreadBacklink: {
		toThread: r.one.dbChannel({
			from: r.dbThreadBacklink.toThreadId,
			to: r.dbChannel.id,
		}),
		fromThread: r.one.dbChannel({
			from: r.dbThreadBacklink.fromThreadId,
			to: r.dbChannel.id,
		}),
	},
}));
