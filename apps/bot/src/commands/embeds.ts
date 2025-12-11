import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from "discord.js";

const idHints =
	process.env.NODE_ENV === "development"
		? ["1421588952359370843"]
		: ["1434079887534198855"];

const testGuild = "1385955477912948806";

@ApplyOptions<Command.Options>({
	name: "print-embed",
	description: "This is used for testing!!",
	runIn: ["GUILD_ANY"],
})
export class ManageAccount extends Command {
	override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) => builder.setName(this.name).setDescription(this.description),
			{
				idHints,
				guildIds: [testGuild],
			},
		);
	}

	override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		if (
			!(interaction.guild && interaction.channel) ||
			interaction.channel?.isDMBased()
		) {
			return;
		}

		if (process.env.NODE_ENV !== "development") return;

		// Discord Limits:
		// - Max 5 ActionRows per message
		// - Max 5 Buttons per ActionRow
		// - Total: 25 buttons maximum

		// Generate random number of rows (1-5)
		const numRows = Math.floor(Math.random() * 5) + 1;

		const rows: ActionRowBuilder<ButtonBuilder>[] = [];

		// Button styles for variety
		const styles = [
			ButtonStyle.Primary,
			ButtonStyle.Secondary,
			ButtonStyle.Success,
			ButtonStyle.Danger,
		];

		// Edge case: Mix of enabled/disabled buttons
		const shouldDisable = () => Math.random() > 0.7;

		// Edge case: Some buttons with/without emojis
		const emojis = [
			"1208688817997873193",
			"✅",
			"❌",
			"🔥",
			"⚡",
			"🎯",
			"📝",
			"🎨",
		];

		for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
			// Generate random number of buttons per row (1-5)
			const numButtons = Math.floor(Math.random() * 5) + 1;
			const buttons: ButtonBuilder[] = [];

			for (let btnIndex = 0; btnIndex < numButtons; btnIndex++) {
				const buttonId = `btn-${rowIndex}-${btnIndex}-${Date.now()}`;
				const style = styles[Math.floor(Math.random() * styles.length)]!;

				// Edge case: Button label length variations
				const labelLengths = [
					"Short",
					"Medium Length",
					"This is a longer button label",
					"Max", // Very short
					"A".repeat(80), // Max length (80 chars)
				];
				const label =
					labelLengths[Math.floor(Math.random() * labelLengths.length)]!;

				const button = new ButtonBuilder()
					.setCustomId(buttonId)
					.setLabel(label)
					.setStyle(style);

				// Edge case: ~50% chance of having an emoji
				if (Math.random() > 0.5) {
					const emoji = emojis[Math.floor(Math.random() * emojis.length)];
					button.setEmoji(emoji);
				}

				// Edge case: Random disabled buttons
				if (shouldDisable()) {
					button.setDisabled(true);
				}

				buttons.push(button);
			}

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
			rows.push(row);
		}

		// Edge case: Sometimes include the original embed, sometimes not
		const includeEmbed = Math.random() > 0.3;

		const embed = new EmbedBuilder()
			.setTitle("Random UI Test")
			.setDescription(
				`Generated ${numRows} row(s) with a total of ${rows.reduce(
					(acc, row) => acc + row.components.length,
					0,
				)} button(s)\n\n**Testing Edge Cases:**\n` +
					`- Mixed button styles\n` +
					`- Random disabled states\n` +
					`- Variable label lengths\n` +
					`- Optional emojis\n` +
					`- 1-5 rows, 1-5 buttons per row`,
			)
			.setThumbnail(
				"https://scnx-cdn.scootkit.net/1708201926425-p37g7IrmLCXdWLQlqPKMULJ1.png",
			)
			.setFooter({
				text: "Powered by scnx.xyz ⚡",
				iconURL: "https://scnx.xyz/favicon.png",
			})
			.setTimestamp()
			.setColor(0x5865f2);

		// Send the message
		await interaction.reply({
			embeds: includeEmbed ? [embed] : [],
			components: rows,
		});
	}
}
