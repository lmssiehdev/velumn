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
		if (process.env.NODE_ENV === "development") {
			registry.registerChatInputCommand(
				(builder) =>
					builder.setName(this.name).setDescription(this.description),
				{
					idHints,
					guildIds: [testGuild],
				},
			);
		}
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

		const embed = generateRandomEmbed();

		await interaction.reply({
			embeds: [embed],
		});
	}
}

function getRandomColor(): number {
	return Math.floor(Math.random() * 16777215); // Random hex color
}

function randomChoice<T>(arr: T[]): T {
	// @ts-expect-error
	return arr[Math.floor(Math.random() * arr.length)];
}

function randomBoolean(): boolean {
	return Math.random() > 0.5;
}

function generateRandomEmbed(): EmbedBuilder {
	const embed = new EmbedBuilder().setColor(getRandomColor()).setTimestamp();

	// Random title
	if (randomBoolean()) {
		embed.setTitle(`Test Embed ${Math.floor(Math.random() * 1000)}`);
	}

	// Random description
	if (randomBoolean()) {
		const lengths = [
			"Short description.",
			"Medium length description with some more text to test wrapping around thumbnails.",
			"Very long description that goes on and on with multiple sentences to really test how the embed handles longer content and text wrapping. This should give a good indication of layout behavior.",
		];
		embed.setDescription(randomChoice(lengths));
	}

	// Random thumbnail
	embed.setThumbnail(
		"https://fastly.picsum.photos/id/881/536/354.jpg?hmac=Ll5K6UU9ITUTDB01DOsNwaeXfj3THF2jQxTdIiaWReU",
	);

	// Random image
	if (randomBoolean()) {
		embed.setImage(
			"https://fastly.picsum.photos/id/881/536/354.jpg?hmac=Ll5K6UU9ITUTDB01DOsNwaeXfj3THF2jQxTdIiaWReU",
		);
	}

	// Random author
	if (randomBoolean()) {
		embed.setAuthor({
			name: "Test Author",
			iconURL:
				"https://fastly.picsum.photos/id/881/536/354.jpg?hmac=Ll5K6UU9ITUTDB01DOsNwaeXfj3THF2jQxTdIiaWReU",
		});
	}

	// Random footer
	if (randomBoolean()) {
		embed.setFooter({
			text: "Test Footer",
			iconURL:
				"https://fastly.picsum.photos/id/881/536/354.jpg?hmac=Ll5K6UU9ITUTDB01DOsNwaeXfj3THF2jQxTdIiaWReU",
		});
	}

	// Random fields (0-5 fields)
	const fieldCount = Math.floor(Math.random() * 6);
	for (let i = 0; i < fieldCount; i++) {
		embed.addFields({
			name: `Field ${i + 1}`,
			value: randomChoice([
				"Short",
				"Medium value text",
				"Longer value text to test field wrapping",
			]),
			inline: randomBoolean(),
		});
	}

	// Random URL
	if (randomBoolean()) {
		embed.setURL("https://discord.com");
	}

	return embed;
}

function generateRandomRows(): ActionRowBuilder<ButtonBuilder>[] {
	const rowCount = Math.floor(Math.random() * 6); // 0-5 rows
	const rows: ActionRowBuilder<ButtonBuilder>[] = [];

	for (let i = 0; i < rowCount; i++) {
		const buttonCount = Math.floor(Math.random() * 5) + 1; // 1-5 buttons per row
		const row = new ActionRowBuilder<ButtonBuilder>();

		for (let j = 0; j < buttonCount; j++) {
			const styles = [
				ButtonStyle.Primary,
				ButtonStyle.Secondary,
				ButtonStyle.Success,
				ButtonStyle.Danger,
			];
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`test_${i}_${j}`)
					.setLabel(`Button ${i + 1}.${j + 1}`)
					.setStyle(randomChoice(styles)),
			);
		}

		rows.push(row);
	}

	return rows;
}

function generateRandomActionRow() {
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
				const emoji = emojis[Math.floor(Math.random() * emojis.length)]!;
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
	return {
		embeds: includeEmbed ? [embed] : [],
		components: rows,
	};
}
