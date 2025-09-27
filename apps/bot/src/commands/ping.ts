import { anonymizeUser } from '@repo/db/helpers/user';
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { toDbUser } from '../helpers/convertion';

const MESSAGES = {
  EMBED: {
    TITLE: 'Account Privacy Settings',
    DESCRIPTION:
      'Configure how Velumn handles your account privacy and data display.',
    COLOR: 0x00_99_ff,
  },
  BUTTONS: {
    ANONYMIZE_LABEL: 'Enable Anonymization',
  },
  RESPONSES: {
    INITIAL: 'Configure your account privacy settings below:',
    ANONYMIZED:
      'Your account has been anonymized. All your public messages will now display a randomized name instead of your username.',
    UNAUTHORIZED:
      'You are not authorized to use this command. Please create your own instance.',
    TIMEOUT:
      'This interaction has timed out. Please run the command again to continue.',
    ERROR: 'An error occurred while updating your settings. Please try again.',
  },
} as const;

const BUTTON_IDS = {
  ANONYMIZE: 'anonymize username',
} as const;

const idHints = ['1421588952359370843'];

@ApplyOptions<Command.Options>({
  name: 'manage-account',
  description: 'Manage how Velumn interacts with your account',
  runIn: ['GUILD_ANY'],
})
export class ManageAccount extends Command {
  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      {
        idHints,
      }
    );
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    if (
      !interaction.guild ||
      !interaction.channel ||
      interaction.channel?.isDMBased()
    )
      return;

    const embed = new EmbedBuilder()
      .setColor(0x00_99_ff)
      .setTitle(MESSAGES.EMBED.TITLE)
      .setDescription(MESSAGES.EMBED.DESCRIPTION)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_IDS.ANONYMIZE)
        .setLabel('Anonymize')
        .setStyle(ButtonStyle.Secondary)
    );

    const reply = await interaction.reply({
      content: MESSAGES.RESPONSES.INITIAL,
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 3 * 60 * 1000,
      filter: (i) => i.user.id === interaction.user.id,
      // && Object.values(menuButtonIds).includes(i.customId),
    });

    collector.on('collect', async (i) => {
      const dbUser = toDbUser(interaction.user);
      const shouldAnonymize = i.customId === BUTTON_IDS.ANONYMIZE;

      await anonymizeUser(dbUser, shouldAnonymize);

      interaction.editReply({
        content: MESSAGES.RESPONSES.ANONYMIZED,
        components: [],
        embeds: [],
      });
      collector.stop();
    });

    collector.on('ignore', async (interaction) => {
      await interaction.followUp({
        content: MESSAGES.RESPONSES.UNAUTHORIZED,
        flags: MessageFlags.Ephemeral,
      });
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({
          content: MESSAGES.RESPONSES.TIMEOUT,
          components: [],
          embeds: [],
        });
      }
    });
  }
}
