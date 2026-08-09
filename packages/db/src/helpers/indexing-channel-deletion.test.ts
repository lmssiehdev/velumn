import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectIndexingChannelDeletionIds,
	type IndexingChannelDeletionScope,
} from "./indexing-channel-deletion";

const channels = [
	{ id: "category", serverId: "guild", parentId: null },
	{ id: "forum", serverId: "guild", parentId: "category" },
	{ id: "thread", serverId: "guild", parentId: "forum" },
];

const collect = (scope: IndexingChannelDeletionScope, rootId: string) =>
	collectIndexingChannelDeletionIds(rootId, scope, async (pending, children) =>
		channels.filter(
			(channel) =>
				pending.includes(channel.id) ||
				(children &&
					channel.parentId !== null &&
					pending.includes(channel.parentId)),
		),
	);

describe("indexing channel deletion", () => {
	it("deletes only a category so its children can survive detached", async () => {
		assert.deepEqual(await collect("self", "category"), [channels[0]]);
	});

	it("keeps the content-container cascade through descendants", async () => {
		assert.deepEqual(await collect("tree", "forum"), [
			channels[1],
			channels[2],
		]);
	});
});
