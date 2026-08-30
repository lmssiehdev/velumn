import {
	ConfigProvider,
	Effect,
	Layer,
	Option,
	Redacted,
	Result,
} from "effect";
import { describe, expect, it } from "vitest";
import { BotConfig } from "./bot-config";

const configEffect = (values: Record<string, string>) =>
	BotConfig.pipe(
		Effect.provide(
			BotConfig.layer.pipe(
				Layer.provide(
					ConfigProvider.layer(
						ConfigProvider.fromEnv({
							env: {
								DISCORD_BOT_TOKEN: "discord-token",
								BOT_API_SECRET: "api-secret",
								...values,
							},
							preserveEmptyStrings: true,
						}),
					),
				),
			),
		),
	);

const loadConfig = (values: Record<string, string>) =>
	Effect.runPromise(configEffect(values));

describe("BotConfig optional service groups", () => {
	it.each(["DISCORD_BOT_TOKEN", "BOT_API_SECRET"])(
		"rejects an empty %s",
		async (name) => {
			const result = await Effect.runPromise(
				Effect.result(configEffect({ [name]: "" })),
			);

			expect(Result.isFailure(result)).toBe(true);
		},
	);

	it("leaves fully absent Meilisearch and R2 groups unconfigured", async () => {
		const config = await loadConfig({});

		expect(Option.isNone(config.meilisearch)).toBe(true);
		expect(Option.isNone(config.r2)).toBe(true);
	});

	it("loads complete groups while keeping the Meilisearch API key optional", async () => {
		const config = await loadConfig({
			MEILISEARCH_HOST: "http://localhost:7700",
			R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
			R2_BUCKET_NAME: "velumn",
			R2_ACCESS_KEY: "access-key",
			R2_SECRET_ACCESS_KEY: "secret-key",
		});

		expect(Option.getOrThrow(config.meilisearch)).toEqual({
			host: "http://localhost:7700",
			apiKey: Option.none(),
		});
		const r2 = Option.getOrThrow(config.r2);
		expect(r2.endpoint).toBe("https://example.r2.cloudflarestorage.com");
		expect(r2.bucketName).toBe("velumn");
		expect(Redacted.value(r2.accessKeyId)).toBe("access-key");
		expect(Redacted.value(r2.secretAccessKey)).toBe("secret-key");
		expect(r2.publicBaseUrl).toBe("https://cdn.velumn.com");
	});

	it("loads a non-empty optional Meilisearch API key", async () => {
		const config = await loadConfig({
			MEILISEARCH_HOST: "http://localhost:7700",
			MEILISEARCH_API_KEY: "search-key",
		});

		const meilisearch = Option.getOrThrow(config.meilisearch);
		expect(Redacted.value(Option.getOrThrow(meilisearch.apiKey))).toBe(
			"search-key",
		);
	});

	it("rejects an empty optional Meilisearch API key", async () => {
		const result = await Effect.runPromise(
			Effect.result(
				configEffect({
					MEILISEARCH_HOST: "http://localhost:7700",
					MEILISEARCH_API_KEY: "",
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
	});

	it("fails when a Meilisearch API key is provided without a host", async () => {
		const result = await Effect.runPromise(
			Effect.result(configEffect({ MEILISEARCH_API_KEY: "search-key" })),
		);

		expect(Result.isFailure(result)).toBe(true);
	});

	it("fails when R2 is partially configured", async () => {
		const result = await Effect.runPromise(
			Effect.result(
				configEffect({
					R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
	});
});
