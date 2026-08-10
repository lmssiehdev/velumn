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
						ConfigProvider.fromUnknown({
							DISCORD_BOT_TOKEN: "discord-token",
							BOT_API_SECRET: "api-secret",
							...values,
						}),
					),
				),
			),
		),
	);

const loadConfig = (values: Record<string, string>) =>
	Effect.runPromise(configEffect(values));

describe("BotConfig optional service groups", () => {
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
