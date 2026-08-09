import {
	type ChatInputCommandInteraction,
	Events,
	type Interaction,
	MessageFlags,
} from "discord.js";
import { Effect, Layer, Schema } from "effect";
import { BotConfig } from "../config/bot-config";
import { DiscordClient } from "../discord/client";
import { Readiness } from "../runtime/readiness";
import { ManageAccount, manageAccountCommand } from "./manage-account";

export class CommandDeploymentError extends Schema.TaggedError<CommandDeploymentError>()(
	"CommandDeploymentError",
	{
		target: Schema.String,
		cause: Schema.Defect(),
	},
) {}

const replyToUnknownCommand = (interaction: ChatInputCommandInteraction) =>
	Effect.tryPromise({
		try: () =>
			interaction.reply({
				content:
					"This command is not available. Discord may still be showing an older command definition.",
				flags: MessageFlags.Ephemeral,
			}),
		catch: (cause) => cause,
	}).pipe(
		Effect.catch((cause) =>
			Effect.logWarning("Failed to reply to unknown command", {
				commandName: interaction.commandName,
				cause,
			}),
		),
	);

export const CommandRegistry = Layer.effectDiscard(
	Effect.gen(function* () {
		const discord = yield* DiscordClient;
		const config = yield* BotConfig;
		const readiness = yield* Readiness;
		const manageAccount = yield* ManageAccount;

		const dispatch = (interaction: Interaction) => {
			if (interaction.isChatInputCommand()) {
				return interaction.commandName === manageAccountCommand.name
					? manageAccount.handleCommand(interaction)
					: replyToUnknownCommand(interaction);
			}
			if (interaction.isButton())
				return manageAccount.handleButton(interaction);
			return Effect.void;
		};

		yield* discord.events.forkOn(Events.InteractionCreate, dispatch);
		yield* readiness.setDiscordReady(true);

		const target =
			config.environment === "production"
				? "global"
				: `guild:${config.developmentGuildId}`;
		yield* Effect.tryPromise({
			try: async () => {
				if (config.environment === "production") {
					await discord.client.application.commands.set([manageAccountCommand]);
					return;
				}
				const guild = await discord.client.guilds.fetch(
					config.developmentGuildId,
				);
				await guild.commands.set([manageAccountCommand]);
			},
			catch: (cause) => new CommandDeploymentError({ target, cause }),
		});
		yield* readiness.setCommandsReady(true);
		yield* Effect.addFinalizer(() =>
			readiness
				.setCommandsReady(false)
				.pipe(Effect.andThen(readiness.setDiscordReady(false))),
		);
		yield* Effect.logInfo("Discord commands ready", { target });
	}),
);
