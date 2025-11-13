import { logger } from "@repo/logger";
import { isEmbeddableAttachment } from "@repo/utils/helpers/misc";
import { eq, inArray } from "drizzle-orm";
import { id } from "zod/locales";
import { db } from "..";
import {
	type DBMessage,
	type DBMessageWithRelations,
	type DBThreadBacklink,
	dbAttachments,
	dbMessage,
	dbThreadBacklink,
} from "../schema";
import { uploadFileFromUrl } from "./upload";
import type { DBAttachments } from "./validation";

export async function deleteMessageById(messageId: string) {
	return await db.delete(dbMessage).where(eq(dbMessage.id, messageId));
}

export async function deleteManyMessagesById(messageIds: string[]) {
	if (messageIds.length === 0) {
		return;
	}
	return await db.delete(dbMessage).where(inArray(dbMessage.id, messageIds));
}

export async function getMessageById(messageId: string) {
	return await db._query.dbMessage.findFirst({
		where: eq(dbMessage.id, messageId),
	});
}

export async function updateMessage(msg: DBMessage) {
	return await db
		.update(dbMessage)
		.set({
			...msg,
		})
		.where(eq(dbMessage.id, msg.id));
}

export async function upsertManyBacklinks(data: DBThreadBacklink[]) {
	if (data.length === 0) {
		return;
	}
	await db.insert(dbThreadBacklink).values(data).onConflictDoNothing();
}

export async function upsertManyMessages(data: DBMessageWithRelations[]) {
	if (data.length === 0) {
		return [];
	}

	const chunkSize = 100;
	const chunks: DBMessageWithRelations[][] = [];
	for (let i = 0; i < data.length; i += chunkSize) {
		chunks.push(data.slice(i, i + chunkSize));
	}
	for (const chunk of chunks) {
		await fastUpsertManyMessages(chunk);
	}

	return data;
}

async function fastUpsertManyMessages(msgs: DBMessageWithRelations[]) {
	if (msgs.length === 0) {
		return;
	}
	const messages = new Map<string, DBMessage>();
	const attachments = new Map<string, DBAttachments>();

	for (const msg of msgs) {
		messages.set(msg.id, msg);
		if (!msg.attachments) {
			continue;
		}

		for (const attachment of msg.attachments) {
			attachments.set(attachment.id, attachment);
		}

		if (msg.snapshot?.attachments?.length) {
			for (const attachment of msg.snapshot.attachments) {
				attachments.set(attachment.id, attachment);
			}
		}
	}

	if (messages.size) {
		await db
			.insert(dbMessage)
			.values(Array.from(messages.values()))
			.onConflictDoNothing();
	}

	if (attachments.size) {
		await processAttachments(Array.from(attachments.values()));
	}
}

export async function upsertAttachement(attachment: DBAttachments) {
	if (!attachment.id) {
		return;
	}
	return await db
		.insert(dbAttachments)
		.values(attachment)
		.onConflictDoNothing();
}

async function processAttachments(attachments: DBAttachments[]) {
	if (attachments.length === 0) {
		return;
	}
	const nonUploadableAttachments = attachments.filter(
		({ contentType, proxyURL }) =>
			!isEmbeddableAttachment({ contentType, proxyURL }),
	);

	if (nonUploadableAttachments.length) {
		await db
			.insert(dbAttachments)
			.values(nonUploadableAttachments)
			.onConflictDoNothing();
	}

	const uploadableAttachments = attachments.filter(
		({ contentType, proxyURL }) =>
			isEmbeddableAttachment({ contentType, proxyURL }),
	);

	if (!uploadableAttachments.length) {
		return;
	}

	const existingAttachments = await db
		.select({ id: dbAttachments.id })
		.from(dbAttachments)
		.where(
			inArray(
				dbAttachments.id,
				uploadableAttachments.map((a) => a.id),
			),
		);

	const existingAttachmentIds = new Set(existingAttachments.map((a) => a.id));

	const newAttachments = uploadableAttachments.filter(
		(attachment) => !existingAttachmentIds.has(attachment.id),
	);

	if (newAttachments.length === 0) {
		return;
	}

	const uploadPromises = newAttachments.map(async (attachment) => {
		const { id, name, contentType, url } = attachment;
		try {
			const file = await uploadFileFromUrl({
				id,
				name,
				contentType: contentType ?? undefined,
				url,
			});
			if (!file?.Location) {
				return;
			}
			const proxyURL = `https://cdn.velumn.com/${id}/${name}`;
			await db
				.insert(dbAttachments)
				.values({
					...attachment,
					proxyURL,
				})
				.onConflictDoNothing();
		} catch (error) {
			logger.error("failed_to_save_attachment_to_db", {
				error,
				id,
				name,
				contentType,
				url,
			});
			return;
		}
	});

	// Don't await, we run this in the background
	Promise.allSettled(uploadPromises);
}
