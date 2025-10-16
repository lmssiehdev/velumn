import { eq, inArray } from 'drizzle-orm';
import { db } from '..';
import {
  type DBMessage,
  type DBMessageWithRelations,
  dbAttachments,
  dbMessage,
} from '../schema';
import { uploadFileFromUrl } from './upload';
import type { DBAttachments } from './validation';

export async function deleteMesasgeById(messageId: string) {
  return await db.delete(dbMessage).where(eq(dbMessage.id, messageId));
}

export async function deleteManyMessagesById(messageIds: string[]) {
  if (messageIds.length === 0) {
    return;
  }
  return await db.delete(dbMessage).where(inArray(dbMessage.id, messageIds));
}

export async function getMessageById(messageId: string) {
  return await db.query.dbMessage.findFirst({
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

    if (msg.snapshot?.attachments.length) {
      for (const attachment of msg.snapshot?.attachments) {
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
  return await db
    .insert(dbAttachments)
    .values(attachment)
    .onConflictDoNothing();
}

async function processAttachments(attachments: DBAttachments[]) {
  const shouldUpload = (ct: string) =>
    ct.startsWith('text/') || ct.startsWith('image/');

  const nonUploadableAttachments = attachments.filter(
    ({ contentType }) => !shouldUpload(contentType ?? '')
  );

  if (nonUploadableAttachments.length) {
    await db
      .insert(dbAttachments)
      .values(nonUploadableAttachments)
      .onConflictDoNothing();
  }

  const uploadableAttachments = attachments.filter(({ contentType }) =>
    shouldUpload(contentType ?? '')
  );

  if (!uploadableAttachments.length) {
    return;
  }

  // we don't await;
  db.select({ id: dbAttachments.id })
    .from(dbAttachments)
    .where(
      inArray(
        dbAttachments.id,
        uploadableAttachments.map((a) => a.id)
      )
    )
    .then(async (existingAttachments) => {
      const existingAttachmentIds = new Set(
        existingAttachments?.map((a) => a.id)
      );
      // TODO: promise.all?
      for await (const attachment of uploadableAttachments) {
        if (existingAttachmentIds.has(attachment.id)) {
          continue;
        }
        const { id, name, contentType, url } = attachment;
        await uploadFileFromUrl({
          id,
          name,
          contentType: contentType ?? undefined,
          url,
        }).then(async (file) => {
          if (!file?.Location) {
            return;
          }
          await db
            .insert(dbAttachments)
            .values({
              ...attachment,
              proxyURL: file.Location,
            })
            .onConflictDoNothing();
        });
      }
    });
}
