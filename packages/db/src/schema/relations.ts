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
		servers: r.many.userServers(),
		polarSubscriptions: r.many.dbPolarSubscription(),
		polarCheckoutAttempts: r.many.dbPolarCheckoutAttempt(),
	},
	session: {
		user: r.one.user({
			from: r.session.userId,
			to: r.user.id,
		}),
	},
	dbServer: {
		channels: r.many.dbChannel(),
		indexingJobs: r.many.dbIndexingJob(),
		polarSubscriptions: r.many.dbPolarSubscription(),
		polarCheckoutAttempts: r.many.dbPolarCheckoutAttempt(),
		grants: r.many.dbServerGrant(),
		domainLifecycle: r.one.dbDomainLifecycle({
			from: r.dbServer.id,
			to: r.dbDomainLifecycle.serverId,
		}),
		users: r.many.userServers(),
	},
	dbPolarSubscription: {
		server: r.one.dbServer({
			from: r.dbPolarSubscription.serverId,
			to: r.dbServer.id,
		}),
		purchaser: r.one.user({
			from: r.dbPolarSubscription.purchaserUserId,
			to: r.user.id,
		}),
	},
	dbPolarCheckoutAttempt: {
		server: r.one.dbServer({
			from: r.dbPolarCheckoutAttempt.serverId,
			to: r.dbServer.id,
		}),
		user: r.one.user({
			from: r.dbPolarCheckoutAttempt.userId,
			to: r.user.id,
		}),
	},
	dbServerGrant: {
		server: r.one.dbServer({
			from: r.dbServerGrant.serverId,
			to: r.dbServer.id,
		}),
	},
	dbDomainLifecycle: {
		server: r.one.dbServer({
			from: r.dbDomainLifecycle.serverId,
			to: r.dbServer.id,
		}),
	},
	dbChannel: {
		backlinks: r.many.dbThreadBacklink({
			from: r.dbChannel.id,
			to: r.dbThreadBacklink.toThreadId,
		}),
		incomingBacklinks: r.many.dbThreadBacklink({
			from: r.dbChannel.id,
			to: r.dbThreadBacklink.toThreadId,
		}),
		outgoingBacklinks: r.many.dbThreadBacklink({
			from: r.dbChannel.id,
			to: r.dbThreadBacklink.fromThreadId,
		}),
		children: r.many.dbChannel({
			from: r.dbChannel.id,
			to: r.dbChannel.parentId,
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
		forumTags: r.many.dbForumTag(),
		appliedTags: r.many.dbChannelAppliedTag(),
		indexingCheckpoint: r.one.dbIndexingCheckpoint({
			from: r.dbChannel.id,
			to: r.dbIndexingCheckpoint.channelId,
		}),
		indexingJobs: r.many.dbIndexingJob(),
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
		backlinks: r.many.dbThreadBacklink(),
	},
	dbForumTag: {
		channel: r.one.dbChannel({
			from: r.dbForumTag.channelId,
			to: r.dbChannel.id,
		}),
		applications: r.many.dbChannelAppliedTag(),
	},
	dbChannelAppliedTag: {
		channel: r.one.dbChannel({
			from: r.dbChannelAppliedTag.channelId,
			to: r.dbChannel.id,
		}),
		tag: r.one.dbForumTag({
			from: r.dbChannelAppliedTag.tagId,
			to: r.dbForumTag.id,
		}),
	},
	dbAttachments: {
		message: r.one.dbMessage({
			from: r.dbAttachments.messageId,
			to: r.dbMessage.id,
		}),
	},
	userServers: {
		user: r.one.user({
			from: r.userServers.userId,
			to: r.user.id,
		}),
		server: r.one.dbServer({
			from: r.userServers.serverId,
			to: r.dbServer.id,
		}),
	},
	dbThreadBacklink: {
		fromMessage: r.one.dbMessage({
			from: r.dbThreadBacklink.fromMessageId,
			to: r.dbMessage.id,
		}),
		toThread: r.one.dbChannel({
			from: r.dbThreadBacklink.toThreadId,
			to: r.dbChannel.id,
		}),
		fromThread: r.one.dbChannel({
			from: r.dbThreadBacklink.fromThreadId,
			to: r.dbChannel.id,
		}),
	},
	dbIndexingCheckpoint: {
		channel: r.one.dbChannel({
			from: r.dbIndexingCheckpoint.channelId,
			to: r.dbChannel.id,
		}),
		updatedByJob: r.one.dbIndexingJob({
			from: r.dbIndexingCheckpoint.updatedByJobId,
			to: r.dbIndexingJob.id,
		}),
	},
	dbIndexingJob: {
		server: r.one.dbServer({
			from: r.dbIndexingJob.serverId,
			to: r.dbServer.id,
		}),
		channel: r.one.dbChannel({
			from: r.dbIndexingJob.channelId,
			to: r.dbChannel.id,
		}),
		checkpoints: r.many.dbIndexingCheckpoint(),
		meiliProjections: r.many.dbMeiliProjection(),
	},
	dbMeiliProjection: {
		job: r.one.dbIndexingJob({
			from: r.dbMeiliProjection.jobId,
			to: r.dbIndexingJob.id,
		}),
	},
}));
