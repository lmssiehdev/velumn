import { LogLevel, SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';
import { botEnv } from './config';
import '@sapphire/plugin-logger/register';

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

export let sapphireClient: SapphireClient<boolean> | null = null;

if (sapphireClient) {
  console.log('Realoding bot;');
} else {
  sapphireClient = new SapphireClient({
    shards: 'auto',
    logger: {
      level: LogLevel.Debug,
    },
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildExpressions,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.GuildMember,
      Partials.Reaction,
      Partials.User,
    ],
  });

  sapphireClient.login(botEnv.DISCORD_BOT_TOKEN);
}
