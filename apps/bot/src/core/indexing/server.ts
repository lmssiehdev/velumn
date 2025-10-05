import { getBulkServersPlan } from '@repo/db/helpers/servers';
import {
  ChannelType,
  type Client,
  type Guild,
  type GuildBasedChannel,
} from 'discord.js';
import { shuffle } from '../../helpers/utils';
import { indexRootChannel } from './channel';
import { Log } from './logger';

export async function indexServers(client: Client) {
  const allGuilds = [...client.guilds.cache.values()];
  const randomizedServers = await randomizeServers(allGuilds);

  for await (const guild of randomizedServers) {
    try {
      const channelsCahe = [...guild.channels.cache.values()];

      if (channelsCahe.length === 0) {
        Log('no_channels', guild);
        return;
      }

      const shuffledChannels = shuffle(channelsCahe);

      for await (const channel of shuffledChannels) {
        if (!isChannelIndexable(channel) || channel.nsfw) {
          continue;
        }
        await indexRootChannel(channel);
      }
    } catch (error) {
      Log('failed_to_fetch_guild', error, guild);
    }
  }
}

export const isChannelIndexable = (channel: GuildBasedChannel) =>
  channel.type === ChannelType.GuildText ||
  channel.type === ChannelType.GuildAnnouncement ||
  channel.type === ChannelType.GuildForum;

async function randomizeServers(allGuilds: Guild[]) {
  const guilds =
    process.env.NODE_END === 'development'
      ? allGuilds
      : allGuilds.filter((x) => x.id === '1385955477912948806');

  try {
    const serversPlans = await getBulkServersPlan(guilds.map((x) => x.id));
    const serverPlanLookup = new Map(serversPlans.map((x) => [x.id, x.plan]));

    const { FREE, PAID, OPEN_SOURCE } = guilds.reduce(
      (acc, curr) => {
        if (!curr.id) {
          return acc;
        }
        const plan = serverPlanLookup.get(curr.id)!;

        if (!plan) {
          this.container.error("Server doesn't exist in the db");
          return acc;
        }

        acc[plan].push(curr);
        return acc;
      },
      {
        FREE: [],
        PAID: [],
        OPEN_SOURCE: [],
      } as Record<'FREE' | 'OPEN_SOURCE' | 'PAID', Guild[]>
    );

    return [...shuffle(PAID), ...shuffle(OPEN_SOURCE), ...shuffle(FREE)];
  } catch (err) {
    console.error('Failed_to_randomize_guilds', err);
    return shuffle(guilds);
  }
}
