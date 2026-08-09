import type { DBUser } from "@repo/db/schema/index";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	InteractionContextType,
	MessageFlags,
	SlashCommandBuilder,
} from "discord.js";
import { Context, Deferred, Effect, Layer, Ref, Schema } from "effect";
import { PrivacyRepository } from "../adapters/repository";
import { SearchIndex } from "../adapters/search";

const commandName = "manage-account";
const sessionDuration = "3 minutes";
const componentPrefix = `${commandName}:`;

type PrivacyAction = "anonymize" | "delete" | "confirm-delete" | "cancel";

interface Session {
	readonly ownerId: string;
	readonly closed: Deferred.Deferred<void>;
	readonly stage: "initial" | "confirm-delete";
}

type SessionClaim =
	| "accepted"
	| "cancelled"
	| "confirming"
	| "expired"
	| "unauthorized";

export class ManageAccountInteractionError extends Schema.TaggedError<ManageAccountInteractionError>()(
	"ManageAccountInteractionError",
	{
		operation: Schema.Literals(["reply", "update", "deferUpdate", "editReply"]),
		cause: Schema.Defect(),
	},
) {}

export const manageAccountCommand = new SlashCommandBuilder()
	.setName(commandName)
	.setDescription("Manage how Velumn uses and displays your account data")
	.setContexts(InteractionContextType.Guild);

const componentId = (sessionId: string, action: PrivacyAction) =>
	`${componentPrefix}${sessionId}:${action}`;

const parseComponentId = (customId: string) => {
	if (!customId.startsWith(componentPrefix)) return undefined;
	const [sessionId, action, ...rest] = customId
		.slice(componentPrefix.length)
		.split(":");
	if (
		!sessionId ||
		rest.length > 0 ||
		(action !== "anonymize" &&
			action !== "delete" &&
			action !== "confirm-delete" &&
			action !== "cancel")
	) {
		return undefined;
	}
	return { sessionId, action } as const;
};

const toPrivacyUser = (
	user: ChatInputCommandInteraction["user"] | ButtonInteraction["user"],
): DBUser => ({
	id: user.id,
	displayName: user.username,
	avatar: user.avatar,
	isBot: user.bot,
	anonymizeName: false,
	isIgnored: false,
});

const interactionEffect = <A>(
	operation: "reply" | "update" | "deferUpdate" | "editReply",
	request: () => Promise<A>,
) =>
	Effect.tryPromise({
		try: request,
		catch: (cause) => new ManageAccountInteractionError({ operation, cause }),
	});

export const makeManageAccount = Effect.fn("makeManageAccount")(function* () {
	const repository = yield* PrivacyRepository;
	const search = yield* SearchIndex;
	const sessions = yield* Ref.make(new Map<string, Session>());

	const claimSession = (
		sessionId: string,
		userId: string,
		action: PrivacyAction,
	) =>
		Effect.gen(function* () {
			const [claim, closed] = yield* Ref.modify(
				sessions,
				(
					current,
				): [
					readonly [SessionClaim, Deferred.Deferred<void> | undefined],
					Map<string, Session>,
				] => {
					const session = current.get(sessionId);
					if (!session) return [["expired", undefined], current];
					if (session.ownerId !== userId) {
						return [["unauthorized", undefined], current];
					}
					if (action === "delete" && session.stage === "initial") {
						const next = new Map(current);
						next.set(sessionId, { ...session, stage: "confirm-delete" });
						return [["confirming", undefined], next];
					}
					if (action === "delete") return [["expired", undefined], current];
					if (
						(action === "confirm-delete" || action === "cancel") &&
						session.stage !== "confirm-delete"
					) {
						return [["expired", undefined], current];
					}
					if (action === "anonymize" && session.stage !== "initial") {
						return [["expired", undefined], current];
					}

					const next = new Map(current);
					next.delete(sessionId);
					return [
						[action === "cancel" ? "cancelled" : "accepted", session.closed],
						next,
					];
				},
			);
			if (closed) yield* Deferred.succeed(closed, undefined);
			return claim;
		});

	const handleCommand = Effect.fn("ManageAccount.handleCommand")(function* (
		interaction: ChatInputCommandInteraction,
	) {
		const sessionId = interaction.id;
		const closed = yield* Deferred.make<void>();
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(componentId(sessionId, "anonymize"))
				.setLabel("Anonymize my name")
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId(componentId(sessionId, "delete"))
				.setLabel("Delete my data")
				.setStyle(ButtonStyle.Danger),
		);
		const embed = new EmbedBuilder()
			.setTitle("Account privacy")
			.setDescription(
				"Anonymize your name on public messages, or permanently remove your stored message content and attachments.",
			)
			.setColor(0x00_99_ff);

		yield* interactionEffect("reply", () =>
			interaction.reply({
				content: "Choose how Velumn should handle your account data.",
				embeds: [embed],
				components: [row],
				flags: MessageFlags.Ephemeral,
			}),
		);
		yield* Ref.update(sessions, (current) => {
			const next = new Map(current);
			next.set(sessionId, {
				ownerId: interaction.user.id,
				closed,
				stage: "initial",
			});
			return next;
		});

		const completed = yield* Effect.raceFirst(
			Deferred.await(closed).pipe(Effect.as("claimed" as const)),
			Effect.sleep(sessionDuration).pipe(Effect.as("expired" as const)),
		);
		if (completed === "claimed") return;

		const expired = yield* Ref.modify(
			sessions,
			(current): [boolean, Map<string, Session>] => {
				if (!current.has(sessionId)) return [false, current];
				const next = new Map(current);
				next.delete(sessionId);
				return [true, next];
			},
		);
		if (expired) {
			yield* interactionEffect("editReply", () =>
				interaction.editReply({
					content: "This menu expired. Run `/manage-account` to try again.",
					components: [],
					embeds: [],
				}),
			).pipe(
				Effect.catch((error) =>
					Effect.logWarning("Failed to expire account privacy menu", {
						userId: interaction.user.id,
						error,
					}),
				),
			);
		}
	});

	const handleButton = Effect.fn("ManageAccount.handleButton")(function* (
		interaction: ButtonInteraction,
	) {
		const component = parseComponentId(interaction.customId);
		if (!component) return false;

		const claim = yield* claimSession(
			component.sessionId,
			interaction.user.id,
			component.action,
		);
		if (claim === "confirming") {
			const confirmationRow =
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId(componentId(component.sessionId, "confirm-delete"))
						.setLabel("Delete my data")
						.setStyle(ButtonStyle.Danger),
					new ButtonBuilder()
						.setCustomId(componentId(component.sessionId, "cancel"))
						.setLabel("Cancel")
						.setStyle(ButtonStyle.Secondary),
				);
			yield* interactionEffect("update", () =>
				interaction.update({
					content:
						"Delete your stored message content and attachments? This cannot be undone.",
					components: [confirmationRow],
					embeds: [],
				}),
			);
			return true;
		}
		if (claim === "cancelled") {
			yield* interactionEffect("update", () =>
				interaction.update({
					content: "No account data was deleted.",
					components: [],
					embeds: [],
				}),
			);
			return true;
		}
		if (claim !== "accepted") {
			yield* interactionEffect("reply", () =>
				interaction.reply({
					content:
						claim === "unauthorized"
							? "This privacy menu belongs to another user. Run `/manage-account` to open your own."
							: "This privacy menu is no longer active. Run `/manage-account` to try again.",
					flags: MessageFlags.Ephemeral,
				}),
			);
			return true;
		}

		yield* interactionEffect("deferUpdate", () => interaction.deferUpdate());
		const user = toPrivacyUser(interaction.user);
		const operation =
			component.action === "anonymize"
				? repository.anonymize(user)
				: repository
						.deleteData(user)
						.pipe(Effect.flatMap(search.deleteMessages));

		yield* operation.pipe(
			Effect.matchEffect({
				onSuccess: () =>
					interactionEffect("editReply", () =>
						interaction.editReply({
							content:
								component.action === "anonymize"
									? "Your public display name is now anonymized."
									: "Your stored message content and attachments were deleted, and future messages will be excluded.",
							components: [],
							embeds: [],
						}),
					),
				onFailure: (error) =>
					Effect.logError("Failed to update account privacy", {
						userId: interaction.user.id,
						action: component.action,
						error,
					}).pipe(
						Effect.andThen(
							interactionEffect("editReply", () =>
								interaction.editReply({
									content:
										"Velumn could not finish this privacy update. Run `/manage-account` and try again.",
									components: [],
									embeds: [],
								}),
							),
						),
					),
			}),
		);
		return true;
	});

	return { handleCommand, handleButton } as const;
});

export class ManageAccount extends Context.Service<
	ManageAccount,
	Effect.Success<ReturnType<typeof makeManageAccount>>
>()("velumn/bot/commands/ManageAccount") {
	static readonly layer = Layer.effect(ManageAccount, makeManageAccount());
}
