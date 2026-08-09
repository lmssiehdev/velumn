import { Effect, Option, Redacted } from "effect";
import { describe, expect, it, vi } from "vitest";
import { BotConfig } from "../config/bot-config";
import { SearchIndex } from "./search";

const search = vi.hoisted(() => vi.fn());

vi.mock("meilisearch", () => ({
	MeiliSearch: class {
		index() {
			return { search };
		}
	},
}));

const config = BotConfig.of({
	discordToken: Redacted.make("discord-token"),
	environment: "test",
	developmentGuildId: "guild-1",
	developmentInstallerUserId: "user-1",
	apiPort: 8001,
	apiSecret: Redacted.make("api-secret"),
	allowedOrigins: [],
	meilisearch: Option.some({
		host: "http://meilisearch.test",
		apiKey: Option.none(),
	}),
	r2: Option.none(),
});

describe("SearchIndex search", () => {
	it("passes the Effect AbortSignal to Meilisearch request options", async () => {
		search.mockResolvedValueOnce({
			hits: [],
			offset: 0,
			limit: 15,
			estimatedTotalHits: 0,
			processingTimeMs: 1,
			query: "effect",
		});

		await Effect.runPromise(
			Effect.gen(function* () {
				const index = yield* SearchIndex;
				yield* index.search({
					serverId: "123456789012345678",
					query: "effect",
				});
			}).pipe(
				Effect.provide(SearchIndex.layerWithConfig),
				Effect.provideService(BotConfig, config),
			),
		);

		expect(search).toHaveBeenCalledWith(
			"effect",
			expect.objectContaining({ showMatchesPosition: true }),
			{ signal: expect.any(AbortSignal) },
		);
	});
});
