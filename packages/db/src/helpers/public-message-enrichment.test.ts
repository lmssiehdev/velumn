import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	classifyPublicReference,
	collectPublicMentionIds,
	enrichPublicMessageMentions,
} from "./public-message-enrichment";

describe("public message mention enrichment", () => {
	it("classifies references without exposing unpublished targets", () => {
		assert.equal(
			classifyPublicReference({
				exists: true,
				published: true,
				messageRedacted: false,
				authorRedacted: false,
			}),
			"available",
		);
		assert.equal(
			classifyPublicReference({
				exists: true,
				published: false,
				messageRedacted: true,
				authorRedacted: true,
			}),
			"unavailable",
		);
		assert.equal(
			classifyPublicReference({
				exists: true,
				published: true,
				messageRedacted: false,
				authorRedacted: true,
			}),
			"redacted",
		);
	});

	it("batches IDs and prefers current rows over stored snapshots", () => {
		const messages = [
			{
				id: "1",
				content: "hello <@2> in <#3> with <@&4>",
				metadata: {
					users: { "2": { username: "old", globalName: null } },
					channels: { "3": { name: "old-channel", type: 0 } },
					roles: { "4": { name: "Moderators", color: 0 } },
				},
			},
		];

		assert.deepEqual(collectPublicMentionIds(messages), {
			users: ["2"],
			channels: ["3"],
		});
		assert.deepEqual(
			enrichPublicMessageMentions(
				messages,
				[{ id: "2", name: "Current user" }],
				[],
			).get("1"),
			{
				users: [
					{
						id: "2",
						state: "available",
						name: "Current user",
						source: "database",
					},
				],
				channels: [
					{
						id: "3",
						state: "available",
						name: "old-channel",
						source: "snapshot",
					},
				],
				roles: [
					{
						id: "4",
						state: "available",
						name: "Moderators",
						source: "snapshot",
					},
				],
			},
		);
	});

	it("does not revive a redacted user from a historical snapshot", () => {
		const messages = [
			{
				id: "1",
				content: "<@2> <#3>",
				metadata: {
					users: { "2": { username: "private", globalName: null } },
				},
			},
		];

		assert.deepEqual(
			enrichPublicMessageMentions(
				messages,
				[{ id: "2", name: "private", redacted: true }],
				[],
			).get("1"),
			{
				users: [{ id: "2", state: "redacted" }],
				channels: [{ id: "3", state: "unavailable" }],
				roles: [],
			},
		);
	});

	it("keeps forwarded snapshot mentions separate from the forwarding message", () => {
		const messages = [
			{ id: "1", content: "message <@2>", metadata: null },
			{
				id: "1:snapshot",
				content: "forwarded <@3> in <#4>",
				metadata: {
					users: { "3": { username: "snapshot-user", globalName: null } },
					channels: { "4": { name: "snapshot-channel", type: 0 } },
				},
			},
		];

		const mentions = enrichPublicMessageMentions(
			messages,
			[
				{ id: "2", name: "Current user" },
				{ id: "3", name: "Current forwarded user" },
			],
			[],
		);

		assert.deepEqual(mentions.get("1"), {
			users: [
				{
					id: "2",
					state: "available",
					name: "Current user",
					source: "database",
				},
			],
			channels: [],
			roles: [],
		});
		assert.deepEqual(mentions.get("1:snapshot"), {
			users: [
				{
					id: "3",
					state: "available",
					name: "Current forwarded user",
					source: "database",
				},
			],
			channels: [
				{
					id: "4",
					state: "available",
					name: "snapshot-channel",
					source: "snapshot",
				},
			],
			roles: [],
		});
	});
});
