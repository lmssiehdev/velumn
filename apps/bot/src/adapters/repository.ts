import type {
	GatewayGuildInstallationInput,
	GatewayGuildInstallationResult,
} from "@repo/db/helpers/servers";
import type { DBUser } from "@repo/db/schema/index";
import { Context, Effect, Layer, Schema } from "effect";

export class PrivacyRepositoryError extends Schema.TaggedError<PrivacyRepositoryError>()(
	"PrivacyRepositoryError",
	{
		operation: Schema.Literals(["anonymize", "deleteData"]),
		cause: Schema.Defect(),
	},
) {}

export class PrivacyRepository extends Context.Service<
	PrivacyRepository,
	{
		readonly anonymize: (
			user: DBUser,
		) => Effect.Effect<void, PrivacyRepositoryError>;
		readonly deleteData: (
			user: DBUser,
		) => Effect.Effect<readonly string[], PrivacyRepositoryError>;
	}
>()("velumn/bot/adapters/PrivacyRepository") {
	static readonly layer = Layer.succeed(
		PrivacyRepository,
		PrivacyRepository.of({
			anonymize: (user) =>
				Effect.tryPromise({
					try: async () => {
						const { anonymizeUser } = await import("@repo/db/helpers/user");
						await anonymizeUser(user, true);
					},
					catch: (cause) =>
						new PrivacyRepositoryError({ operation: "anonymize", cause }),
				}),
			deleteData: (user) =>
				Effect.tryPromise({
					try: async () => {
						const { ignoreDiscordUser } = await import("@repo/db/helpers/user");
						return await ignoreDiscordUser(user);
					},
					catch: (cause) =>
						new PrivacyRepositoryError({ operation: "deleteData", cause }),
				}),
		}),
	);
}

export class GuildInstallationRepositoryError extends Schema.TaggedError<GuildInstallationRepositoryError>()(
	"GuildInstallationRepositoryError",
	{
		operation: Schema.Literal("complete-installation"),
		cause: Schema.Defect(),
	},
) {}

export class GuildInstallationRepository extends Context.Service<
	GuildInstallationRepository,
	{
		readonly complete: (
			input: GatewayGuildInstallationInput,
		) => Effect.Effect<
			GatewayGuildInstallationResult,
			GuildInstallationRepositoryError
		>;
	}
>()("velumn/bot/adapters/GuildInstallationRepository") {
	static readonly layer = Layer.succeed(
		GuildInstallationRepository,
		GuildInstallationRepository.of({
			complete: (input) =>
				Effect.tryPromise({
					try: async () => {
						const { completeGatewayGuildInstallation } =
							await import("@repo/db/helpers/servers");
						return await completeGatewayGuildInstallation(input);
					},
					catch: (cause) =>
						new GuildInstallationRepositoryError({
							operation: "complete-installation",
							cause,
						}),
				}),
		}),
	);
}
