import { LogLevel, SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';
import { botEnv } from './config';
import '@sapphire/plugin-logger/register';

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

let client: SapphireClient<boolean> | null = null;

if (client) {
  console.log('Realoding bot;');
} else {
  client = new SapphireClient({
    shards: 'auto',
    logger: {
      level: LogLevel.Debug
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

  client.login(botEnv.DISCORD_BOT_TOKEN);
}
