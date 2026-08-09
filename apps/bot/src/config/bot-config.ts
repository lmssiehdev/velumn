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
			const discordToken = yield* Config.redacted("DISCORD_BOT_TOKEN");
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
			const configuredApiSecret = yield* Config.option(
				Config.redacted("BOT_API_SECRET"),
			);
			const apiSecret = Option.getOrElse(
				configuredApiSecret,
				() => discordToken,
			);
			const webOrigin = yield* Config.string("NEXT_PUBLIC_VELUMN_URL").pipe(
				Config.withDefault("http://localhost:3000"),
			);
			const dashboardOrigin = yield* Config.string(
				"NEXT_PUBLIC_VELUMN_DASHBOARD_URL",
			).pipe(Config.withDefault("http://localhost:3001"));
			const meilisearch = yield* Config.option(
				Config.all({
					host: nonEmptyConfig("MEILISEARCH_HOST"),
					apiKey: Config.option(Config.redacted("MEILISEARCH_API_KEY")),
				}),
			);
			const r2 = yield* Config.option(
				Config.all({
					endpoint: nonEmptyConfig("R2_ENDPOINT"),
					bucketName: nonEmptyConfig("R2_BUCKET_NAME"),
					accessKeyId: nonEmptyConfig("R2_ACCESS_KEY").pipe(
						Config.map(Redacted.make),
					),
					secretAccessKey: nonEmptyConfig("R2_SECRET_ACCESS_KEY").pipe(
						Config.map(Redacted.make),
					),
					publicBaseUrl: nonEmptyConfig("R2_PUBLIC_BASE_URL").pipe(
						Config.withDefault("https://cdn.velumn.com"),
					),
				}),
			);
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
