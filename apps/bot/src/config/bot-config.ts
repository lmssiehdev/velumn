import {
	Config,
	Context,
	Effect,
	Layer,
	Option,
	Redacted,
	Schema,
} from "effect";

export type BotEnvironment = "development" | "production" | "test";

export interface R2Config {
	readonly endpoint: string;
	readonly bucketName: string;
	readonly accessKeyId: Redacted.Redacted<string>;
	readonly secretAccessKey: Redacted.Redacted<string>;
	readonly publicBaseUrl: string;
}

export interface MeilisearchConfig {
	readonly host: string;
	readonly apiKey: Option.Option<Redacted.Redacted<string>>;
}

const nonEmptyConfig = (name: string) =>
	Config.schema(Schema.NonEmptyString, name);

export class BotConfig extends Context.Service<
	BotConfig,
	{
		readonly discordToken: Redacted.Redacted<string>;
		readonly environment: BotEnvironment;
		readonly developmentGuildId: string;
		readonly developmentInstallerUserId: string;
		readonly apiPort: number;
		readonly apiSecret: Redacted.Redacted<string>;
		readonly allowedOrigins: readonly string[];
		readonly meilisearch: Option.Option<MeilisearchConfig>;
		readonly r2: Option.Option<R2Config>;
	}
>()("velumn/bot/config/BotConfig") {
	static readonly layer = Layer.effect(
		BotConfig,
		Effect.gen(function* () {
			const discordToken = yield* nonEmptyConfig("DISCORD_BOT_TOKEN").pipe(
				Config.map(Redacted.make),
			);
			const environment = yield* Config.literals(
				["development", "production", "test"],
				"NODE_ENV",
			).pipe(Config.withDefault("development"));
			const developmentGuildId = yield* Config.string(
				"DISCORD_DEVELOPMENT_GUILD_ID",
			).pipe(Config.withDefault("1385955477912948806"));
			const developmentInstallerUserId = yield* Config.string(
				"DISCORD_DEVELOPMENT_INSTALLER_USER_ID",
			).pipe(Config.withDefault("1335068922067550229"));
			const apiPort = yield* Config.number("BOT_API_PORT").pipe(
				Config.withDefault(8001),
			);
			const apiSecret = yield* nonEmptyConfig("BOT_API_SECRET").pipe(
				Config.map(Redacted.make),
			);
			const webOrigin = yield* Config.string("NEXT_PUBLIC_VELUMN_URL").pipe(
				Config.withDefault("http://localhost:3000"),
			);
			const dashboardOrigin = yield* Config.string(
				"NEXT_PUBLIC_VELUMN_DASHBOARD_URL",
			).pipe(Config.withDefault("http://localhost:3001"));
			const meilisearchHost = yield* Config.option(
				nonEmptyConfig("MEILISEARCH_HOST"),
			);
			const meilisearchApiKey = yield* Config.option(
				nonEmptyConfig("MEILISEARCH_API_KEY").pipe(Config.map(Redacted.make)),
			);
			let meilisearch: Option.Option<MeilisearchConfig> = Option.none();
			if (Option.isSome(meilisearchHost) || Option.isSome(meilisearchApiKey)) {
				const host = yield* nonEmptyConfig("MEILISEARCH_HOST");
				meilisearch = Option.some({ host, apiKey: meilisearchApiKey });
			}
			const r2Required = {
				endpoint: nonEmptyConfig("R2_ENDPOINT"),
				bucketName: nonEmptyConfig("R2_BUCKET_NAME"),
				accessKeyId: nonEmptyConfig("R2_ACCESS_KEY").pipe(
					Config.map(Redacted.make),
				),
				secretAccessKey: nonEmptyConfig("R2_SECRET_ACCESS_KEY").pipe(
					Config.map(Redacted.make),
				),
			};
			const r2Presence = yield* Config.all({
				endpoint: Config.option(r2Required.endpoint),
				bucketName: Config.option(r2Required.bucketName),
				accessKeyId: Config.option(r2Required.accessKeyId),
				secretAccessKey: Config.option(r2Required.secretAccessKey),
			});
			let r2: Option.Option<R2Config> = Option.none();
			if (
				Option.isSome(r2Presence.endpoint) ||
				Option.isSome(r2Presence.bucketName) ||
				Option.isSome(r2Presence.accessKeyId) ||
				Option.isSome(r2Presence.secretAccessKey)
			) {
				const required = yield* Config.all(r2Required);
				const publicBaseUrl = yield* nonEmptyConfig("R2_PUBLIC_BASE_URL").pipe(
					Config.withDefault("https://cdn.velumn.com"),
				);
				r2 = Option.some({ ...required, publicBaseUrl });
			}
			return BotConfig.of({
				discordToken,
				environment,
				developmentGuildId,
				developmentInstallerUserId,
				apiPort,
				apiSecret,
				allowedOrigins: [webOrigin, dashboardOrigin],
				meilisearch,
				r2,
			});
		}),
	);
}
