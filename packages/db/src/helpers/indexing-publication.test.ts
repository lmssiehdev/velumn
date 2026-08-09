import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChannelType } from "discord-api-types/v10";
import { drizzle } from "drizzle-orm/node-postgres";

process.env.DATABASE_URL ??= "postgres://localhost/velumn_test";

describe("Meili projection publication predicate", () => {
	it("matches the canonical public thread policy without querying PostgreSQL", async () => {
		const { loadMeiliProjectionSource } = await import("./indexing");
		let statement = "";
		let parameters: unknown[] = [];
		const database = drizzle.mock({
			logger: {
				logQuery(query, params) {
					statement = query.replace(/\s+/g, " ");
					parameters = params;
				},
			},
		});

		await assert.rejects(
			loadMeiliProjectionSource(
				{
					entityId: "thread-1",
					operation: "container_refresh",
					serverId: "server-1",
				},
				database as never,
			),
		);

		assert.match(
			statement,
			/inner join "db_channel" "projection_parent" on "db_channel"\."parent_id" = "projection_parent"\."id"/,
		);
		assert.match(statement, /"db_channel"\."type" in \(\$\d+, \$\d+\)/);
		assert.deepEqual(parameters.slice(2, 4), [
			ChannelType.PublicThread,
			ChannelType.AnnouncementThread,
		]);
		assert.match(
			statement,
			/"projection_parent"\."server_id" = "db_channel"\."server_id"/,
		);
		assert.match(statement, /"projection_parent"\."parent_id" is null/);
		assert.match(
			statement,
			/exists \(select 1 from "db_channel" "projection_parent_category"/,
		);
		assert.match(
			statement,
			/"projection_parent_category"\."id" = "projection_parent"\."parent_id"/,
		);
		assert.match(
			statement,
			/"projection_parent_category"\."server_id" = "projection_parent"\."server_id"/,
		);
		assert.equal(parameters[4], ChannelType.GuildCategory);
		assert.match(
			statement,
			/"projection_parent"\."type" in \(\$\d+, \$\d+, \$\d+\)/,
		);
		assert.match(statement, /"projection_parent"\."indexing_enabled" = \$\d+/);
		assert.match(
			statement,
			/exists \(select 1 from "db_message" "projection_starter" inner join "db_user" "projection_starter_author"/,
		);
		assert.match(statement, /"db_server"\."kicked_at" is null/);
		assert.match(statement, /"db_message"\."is_ignored" = \$\d+/);
		assert.match(
			statement,
			/"projection_starter_author"\."can_publicly_display_messages" is null.*"projection_starter_author"\."can_publicly_display_messages" = \$\d+/,
		);
		assert.match(
			statement,
			/"projection_author"\."can_publicly_display_messages" is null.*"projection_author"\."can_publicly_display_messages" = \$\d+/,
		);
		assert.doesNotMatch(statement, /"db_channel"\."indexing_enabled"/);
	});
});
