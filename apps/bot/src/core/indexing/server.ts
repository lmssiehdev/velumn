import { createBulkServers } from '@repo/db/helpers/servers';
import {
  ChannelType,
  type Client,
  type Guild
} from 'discord.js';
import {
  toDbServer
} from '../../helpers/convertion';
import { indexRootChannel } from './channel';
import { Log } from './logger';


export async function indexServers(client: Client) {
  const allGuilds = [...client.guilds.cache.values()];

  const devGuild = allGuilds.find((x) => x.id === '1228579842212106302');
  const guilds = devGuild ? [devGuild] : allGuilds;

  // create a server when the bot gets added to a guild
  // to avoid this
  await createBulkServers(guilds.map((x) => toDbServer(x)));

  for await (const guild of guilds) {
    await indexGuild(guild);
  }
}

export async function indexGuild(guild: Guild) {
  try {
    const channelsCahe = [...guild.channels.cache.values()];

    if (channelsCahe.length === 0) {
      Log('no_channels', guild);
      return;
    }
    for await (const channel of channelsCahe) {
      if (
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement ||
        channel.type === ChannelType.GuildForum
      ) {
        if (channel.nsfw) {
          continue;
        }
        await indexRootChannel(channel);
      }
    }
  } catch (error) {
    Log('failed_to_fetch_guild', error, guild);
  }
}