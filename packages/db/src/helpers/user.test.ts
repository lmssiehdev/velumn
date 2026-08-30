import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DiscordUserPrivacyDatabase } from "./user";

describe("ignoreDiscordUser", () => {
	it("persists privacy state and purge projections in one transaction", async () => {
		process.env.DATABASE_URL ??= "postgres://localhost/velumn_test";
		const { ignoreDiscordUser } = await import("./user");
		const messages = [
			{ id: "message-1", partitionKey: "thread-1", serverId: "server-1" },
			{ id: "message-2", partitionKey: null, serverId: "server-1" },
		];
		const operations: string[] = [];
		const projections: Array<{
			operation: "message_delete";
			entityId: string;
			partitionKey: string;
			serverId: string;
			jobId: null;
		}> = [];
		let transactionCount = 0;
		const database: DiscordUserPrivacyDatabase = {
			transaction: async (run) => {
				transactionCount += 1;
				return await run({
					findAuthoredMessages: async () => messages,
					upsertIgnoredUser: async () => {
						operations.push("ignore-user");
					},
					deleteMessageAttachments: async () => {
						operations.push("delete-attachments");
					},
					redactAuthoredMessages: async () => {
						operations.push("redact-messages");
					},
					enqueueMessagePurges: async (purges) => {
						operations.push("enqueue-purge");
						projections.push(
							...purges.map((message) => ({
								operation: "message_delete" as const,
								entityId: message.id,
								partitionKey: message.partitionKey ?? message.id,
								serverId: message.serverId,
								jobId: null,
							})),
						);
					},
				});
			},
		};
		const user = {
			id: "user-1",
			displayName: "User",
			avatar: null,
			isBot: false,
			anonymizeName: false,
			isIgnored: false,
		};

		assert.deepEqual(await ignoreDiscordUser(user, database), [
			"message-1",
			"message-2",
		]);
		assert.equal(transactionCount, 1);
		assert.deepEqual(operations, [
			"ignore-user",
			"delete-attachments",
			"redact-messages",
			"enqueue-purge",
		]);
		assert.deepEqual(projections, [
			{
				operation: "message_delete",
				entityId: "message-1",
				partitionKey: "thread-1",
				serverId: "server-1",
				jobId: null,
			},
			{
				operation: "message_delete",
				entityId: "message-2",
				partitionKey: "message-2",
				serverId: "server-1",
				jobId: null,
			},
		]);
	});
});
