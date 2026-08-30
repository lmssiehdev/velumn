import { assert, describe, it } from "@effect/vitest";
import type {
	ButtonInteraction,
	ChatInputCommandInteraction,
	InteractionEditReplyOptions,
	InteractionReplyOptions,
	InteractionUpdateOptions,
} from "discord.js";
import { Deferred, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import {
	PrivacyRepository,
	PrivacyRepositoryError,
} from "../adapters/repository";
import { SearchIndex } from "../adapters/search";
import { makeManageAccount } from "./manage-account";

const user = {
	id: "user-1",
	username: "privacy-user",
	avatar: null,
	bot: false,
};

interface CommandHarness {
	readonly interaction: ChatInputCommandInteraction;
	readonly replied: Deferred.Deferred<void>;
	readonly edits: InteractionEditReplyOptions[];
}

const commandInteraction = (
	value: Parameters<typeof structuredClone>[0],
): ChatInputCommandInteraction => value as ChatInputCommandInteraction;

const buttonInteraction = (
	value: Parameters<typeof structuredClone>[0],
): ButtonInteraction => value as ButtonInteraction;

const makeCommandHarness = Effect.fn("makeCommandHarness")(function* (
	id = "session-1",
) {
	const replied = yield* Deferred.make<void>();
	const edits: InteractionEditReplyOptions[] = [];
	const interaction = commandInteraction({
		id,
		user,
		reply: async (_options: InteractionReplyOptions) => {
			Deferred.doneUnsafe(replied, Effect.void);
			return {};
		},
		editReply: async (options: InteractionEditReplyOptions) => {
			edits.push(options);
			return {};
		},
	});

	return { interaction, replied, edits } satisfies CommandHarness;
});

const makeButton = (
	customId: string,
	events: string[],
	overrideUser = user,
) => {
	const replies: InteractionReplyOptions[] = [];
	const edits: InteractionEditReplyOptions[] = [];
	const updates: InteractionUpdateOptions[] = [];
	const interaction = buttonInteraction({
		customId,
		user: overrideUser,
		deferUpdate: async () => {
			events.push("defer");
			return {};
		},
		update: async (options: InteractionUpdateOptions) => {
			updates.push(options);
			events.push("update");
			return {};
		},
		reply: async (options: InteractionReplyOptions) => {
			replies.push(options);
			return {};
		},
		editReply: async (options: InteractionEditReplyOptions) => {
			edits.push(options);
			events.push("edit");
			return {};
		},
	});

	return { interaction, replies, edits, updates };
};

const makeService = (
	repository: PrivacyRepository["Service"],
	search: SearchIndex["Service"],
) =>
	makeManageAccount().pipe(
		Effect.provideService(PrivacyRepository, repository),
		Effect.provideService(SearchIndex, search),
	);

const makeSearchIndex = (
	overrides: Partial<SearchIndex["Service"]> = {},
): SearchIndex["Service"] =>
	SearchIndex.of({
		addDocuments: () => Effect.void,
		updateDocuments: () => Effect.void,
		deleteMessages: () => Effect.void,
		deleteThread: () => Effect.void,
		updateThreadTitle: () => Effect.void,
		search: () => Effect.die("Search is not used by this test"),
		health: Effect.die("Search health is not used by this test"),
		...overrides,
	});

describe("manage-account", () => {
	it.effect("acknowledges and serializes an anonymization action", () =>
		Effect.gen(function* () {
			const events: string[] = [];
			const service = yield* makeService(
				PrivacyRepository.of({
					anonymize: () => Effect.sync(() => events.push("repository")),
					deleteData: () => Effect.succeed([]),
				}),
				makeSearchIndex(),
			);
			const command = yield* makeCommandHarness();
			const commandFiber = yield* Effect.forkChild(
				service.handleCommand(command.interaction),
			);
			yield* Deferred.await(command.replied);
			yield* Effect.yieldNow;

			const button = makeButton("manage-account:session-1:anonymize", events);
			yield* service.handleButton(button.interaction);
			yield* Fiber.join(commandFiber);

			assert.deepEqual(events, ["defer", "repository", "edit"]);
			assert.include(String(button.edits[0]?.content), "now anonymized");
		}),
	);

	it.effect("purges search only after deleting stored data", () =>
		Effect.gen(function* () {
			const events: string[] = [];
			const service = yield* makeService(
				PrivacyRepository.of({
					anonymize: () => Effect.void,
					deleteData: () =>
						Effect.sync(() => {
							events.push("repository");
							return ["message-1", "message-2"];
						}),
				}),
				makeSearchIndex({
					deleteMessages: (messageIds) =>
						Effect.sync(() => {
							assert.deepEqual(messageIds, ["message-1", "message-2"]);
							events.push("search");
						}),
				}),
			);
			const command = yield* makeCommandHarness();
			const commandFiber = yield* Effect.forkChild(
				service.handleCommand(command.interaction),
			);
			yield* Deferred.await(command.replied);
			yield* Effect.yieldNow;

			const deleteButton = makeButton(
				"manage-account:session-1:delete",
				events,
			);
			yield* service.handleButton(deleteButton.interaction);
			assert.include(
				String(deleteButton.updates[0]?.content),
				"cannot be undone",
			);
			assert.deepEqual(events, ["update"]);

			const button = makeButton(
				"manage-account:session-1:confirm-delete",
				events,
			);
			yield* service.handleButton(button.interaction);
			yield* Fiber.join(commandFiber);

			assert.deepEqual(events, [
				"update",
				"defer",
				"repository",
				"search",
				"edit",
			]);
			assert.include(String(button.edits[0]?.content), "were deleted");
		}),
	);

	it.effect("renders a failure instead of success when persistence fails", () =>
		Effect.gen(function* () {
			const service = yield* makeService(
				PrivacyRepository.of({
					anonymize: () =>
						Effect.fail(
							new PrivacyRepositoryError({
								operation: "anonymize",
								cause: new Error("database unavailable"),
							}),
						),
					deleteData: () => Effect.succeed([]),
				}),
				makeSearchIndex(),
			);
			const command = yield* makeCommandHarness();
			yield* Effect.forkChild(service.handleCommand(command.interaction));
			yield* Deferred.await(command.replied);
			yield* Effect.yieldNow;
			const button = makeButton("manage-account:session-1:anonymize", []);

			yield* service.handleButton(button.interaction);

			assert.include(String(button.edits[0]?.content), "could not finish");
			assert.notInclude(String(button.edits[0]?.content), "now anonymized");
		}),
	);

	it.effect("cancels deletion without calling persistence", () =>
		Effect.gen(function* () {
			let deleteCalls = 0;
			const service = yield* makeService(
				PrivacyRepository.of({
					anonymize: () => Effect.void,
					deleteData: () =>
						Effect.sync(() => {
							deleteCalls += 1;
							return [];
						}),
				}),
				makeSearchIndex(),
			);
			const command = yield* makeCommandHarness();
			const commandFiber = yield* Effect.forkChild(
				service.handleCommand(command.interaction),
			);
			yield* Deferred.await(command.replied);
			yield* Effect.yieldNow;

			yield* service.handleButton(
				makeButton("manage-account:session-1:delete", []).interaction,
			);
			const cancel = makeButton("manage-account:session-1:cancel", []);
			yield* service.handleButton(cancel.interaction);
			yield* Fiber.join(commandFiber);

			assert.strictEqual(deleteCalls, 0);
			assert.include(String(cancel.updates[0]?.content), "No account data");
		}),
	);

	it.effect("expires an unused menu after three minutes", () =>
		Effect.gen(function* () {
			const service = yield* makeService(
				PrivacyRepository.of({
					anonymize: () => Effect.void,
					deleteData: () => Effect.succeed([]),
				}),
				makeSearchIndex(),
			);
			const command = yield* makeCommandHarness();
			const fiber = yield* Effect.forkChild(
				service.handleCommand(command.interaction),
			);
			yield* Deferred.await(command.replied);
			yield* Effect.yieldNow;

			yield* TestClock.adjust("3 minutes");
			yield* Fiber.join(fiber);

			assert.include(String(command.edits[0]?.content), "menu expired");
		}),
	);
});
