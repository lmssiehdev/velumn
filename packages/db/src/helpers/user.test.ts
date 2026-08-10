import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("ignoreDiscordUser", () => {
	it("persists privacy state and purge projections in one transaction", async () => {
		process.env.DATABASE_URL ??= "postgres://localhost/velumn_test";
		const [{ ignoreDiscordUser }, { dbDiscordUser, dbMeiliProjection }] =
			await Promise.all([import("./user"), import("../schema")]);
		const messages = [
			{ id: "message-1", partitionKey: "thread-1", serverId: "server-1" },
			{ id: "message-2", partitionKey: null, serverId: "server-1" },
		];
		const operations: string[] = [];
		const projections: unknown[] = [];
		let transactionCount = 0;
		const transaction = {
			transaction: async (run: (tx: unknown) => Promise<unknown>) => {
				transactionCount += 1;
				const tx = {
					select: () => ({
						from: () => ({ where: async () => messages }),
					}),
					insert: (table: unknown) => ({
						values: (values: unknown) =>
							table === dbDiscordUser
								? {
										onConflictDoUpdate: async () => {
											operations.push("ignore-user");
										},
									}
								: {
										returning: async () => {
											assert.equal(table, dbMeiliProjection);
											operations.push("enqueue-purge");
											projections.push(...(values as unknown[]));
											return [];
										},
									},
					}),
					delete: () => ({
						where: async () => {
							operations.push("delete-attachments");
						},
					}),
					update: () => ({
						set: () => ({
							where: async () => {
								operations.push("redact-messages");
							},
						}),
					}),
				};
				return await run(tx);
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

		assert.deepEqual(
			await ignoreDiscordUser(
				user,
				transaction as unknown as NonNullable<
					Parameters<typeof ignoreDiscordUser>[1]
				>,
			),
			["message-1", "message-2"],
		);
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
