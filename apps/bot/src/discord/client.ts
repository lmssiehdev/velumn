import {
	Client,
	type ClientOptions,
	Events,
	GatewayIntentBits,
	Partials,
} from "discord.js";
import {
	Context,
	Deferred,
	type Duration,
	Effect,
	Layer,
	Redacted,
	Schema,
	type Scope,
} from "effect";
import { BotConfig } from "../config/bot-config";
import { type DiscordEvents, makeDiscordEvents } from "./events";

export class DiscordLoginError extends Schema.TaggedError<DiscordLoginError>()(
	"DiscordLoginError",
	{
		message: Schema.String,
		cause: Schema.Defect(),
	},
) {}

const clientOptions = {
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.MessageContent,
	],
	partials: [
		Partials.Channel,
		Partials.Message,
		Partials.GuildMember,
		Partials.Reaction,
		Partials.User,
	],
} satisfies ClientOptions;

interface MakeDiscordClientOptions {
	readonly makeClient?: () => Client;
	readonly login?: (client: Client, token: string) => Promise<string>;
	readonly loginTimeout?: Duration.Input;
	readonly handlerDrainTimeout?: Duration.Input;
}

export interface DiscordConnectionService {
	readonly client: Client;
	readonly events: DiscordEvents;
}

const loginClient = (
	client: Client,
	events: DiscordEvents,
	token: Redacted.Redacted<string>,
	options: MakeDiscordClientOptions,
): Effect.Effect<Client<true>, DiscordLoginError> =>
	Effect.scoped(
		Effect.gen(function* () {
			const readyClient = yield* Deferred.make<
				Client<true>,
				DiscordLoginError
			>();

			yield* events.once(Events.ClientReady, (ready) => {
				Deferred.doneUnsafe(readyClient, Effect.succeed(ready));
			});
			yield* events.once(Events.Error, (cause) => {
				Deferred.doneUnsafe(
					readyClient,
					Effect.fail(
						new DiscordLoginError({
							message: "Discord emitted an error while connecting",
							cause,
						}),
					),
				);
			});

			yield* Effect.tryPromise({
				try: () =>
					(options.login ?? ((client, token) => client.login(token)))(
						client,
						Redacted.value(token),
					),
				catch: (cause) =>
					new DiscordLoginError({
						message: "Failed to log in to Discord",
						cause,
					}),
			});

			return yield* Deferred.await(readyClient);
		}),
	).pipe(
		Effect.timeout(options.loginTimeout ?? "30 seconds"),
		Effect.catchTag("TimeoutError", (cause) =>
			Effect.fail(
				new DiscordLoginError({
					message: "Timed out waiting for Discord to become ready",
					cause,
				}),
			),
		),
	);

export const makeDiscordClient = (
	token: Redacted.Redacted<string>,
	options: MakeDiscordClientOptions = {},
): Effect.Effect<DiscordClient["Service"], DiscordLoginError, Scope.Scope> =>
	Effect.gen(function* () {
		const connection = yield* makeDiscordConnection(options);
		return yield* loginDiscordConnection(connection, token, options);
	});

export const makeDiscordConnection = (
	options: MakeDiscordClientOptions = {},
): Effect.Effect<DiscordConnectionService, never, Scope.Scope> =>
	Effect.gen(function* () {
		const client = yield* Effect.acquireRelease(
			Effect.sync(() =>
				(options.makeClient ?? (() => new Client(clientOptions)))(),
			),
			(client) =>
				Effect.tryPromise({
					try: () => client.destroy(),
					catch: (cause) => cause,
				}).pipe(
					Effect.catch((cause) =>
						Effect.logWarning("Failed to destroy Discord client", { cause }),
					),
				),
		);
		const events = yield* makeDiscordEvents(client, {
			handlerDrainTimeout: options.handlerDrainTimeout,
		});

		yield* events.forkOn(Events.Error, (cause) =>
			Effect.logError("Discord client error", { cause }),
		);
		yield* events.forkOn(Events.Warn, (warning) =>
			Effect.logWarning("Discord client warning", { warning }),
		);
		return { client, events };
	});

export const loginDiscordConnection = (
	connection: DiscordConnectionService,
	token: Redacted.Redacted<string>,
	options: MakeDiscordClientOptions = {},
): Effect.Effect<DiscordClient["Service"], DiscordLoginError> =>
	Effect.gen(function* () {
		const readyClient = yield* loginClient(
			connection.client,
			connection.events,
			token,
			options,
		);
		yield* Effect.logInfo("Discord client ready", {
			userId: readyClient.user?.id,
		});

		return DiscordClient.of({ client: readyClient, events: connection.events });
	});

export class DiscordConnection extends Context.Service<
	DiscordConnection,
	DiscordConnectionService
>()("velumn/bot/discord/DiscordConnection") {
	static readonly layer = Layer.effect(
		DiscordConnection,
		makeDiscordConnection(),
	);
}

export class DiscordStartupBarrier extends Context.Service<
	DiscordStartupBarrier,
	true
>()("velumn/bot/discord/DiscordStartupBarrier") {}

export class DiscordClient extends Context.Service<
	DiscordClient,
	{
		readonly client: Client<true>;
		readonly events: DiscordEvents;
	}
>()("velumn/bot/discord/DiscordClient") {
	static readonly layerWithConfig = Layer.effect(
		DiscordClient,
		Effect.gen(function* () {
			const config = yield* BotConfig;
			const connection = yield* DiscordConnection;
			yield* DiscordStartupBarrier;
			return yield* loginDiscordConnection(connection, config.discordToken);
		}),
	);

	static readonly layer = this.layerWithConfig.pipe(
		Layer.provide(
			Layer.mergeAll(
				BotConfig.layer,
				DiscordConnection.layer,
				Layer.succeed(DiscordStartupBarrier, true),
			),
		),
	);
}
