import {
  getBulkServers,
  updateServer,
  upsertServer,
} from '@repo/db/helpers/servers';
import {
  ChannelType,
  type Client,
  type Guild,
  type GuildBasedChannel,
} from 'discord.js';
import { TEST_GUILDS } from '../constants';
import { toDbServer } from '../helpers/convertion';
import { createServerInvite } from '../helpers/create-invite';
import { safeStringify } from '../helpers/lib/log';
import { shuffle } from '../helpers/utils';
import { indexChannel } from './channel';
import { Log } from './logger';
import { logger } from '@repo/logger';

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
        await indexChannel(channel);
      }
      console.log('Done indexing server', guild.name, guild.id);
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
    process.env.NODE_ENV !== 'development'
      ? allGuilds
      : allGuilds.filter((x) => x.id === TEST_GUILDS.T);

  try {
    const serversPlans = await getBulkServers(guilds.map((x) => x.id));
    const serverPlanLookup = new Map(
      serversPlans.map(({ id, plan, serverInvite }) => [
        id,
        { plan, serverInvite },
      ])
    );

    const result: Record<'FREE' | 'OPEN_SOURCE' | 'PAID', Guild[]> = {
      FREE: [],
      PAID: [],
      OPEN_SOURCE: [],
    };

    for (const guild of guilds) {
      if (!guild.id) {
        continue;
      }
      let { plan, serverInvite } = serverPlanLookup.get(guild.id)! ?? {};

      if (process.env.NODE_ENV === 'development') {
        const converted = toDbServer(guild);
        await upsertServer({
          ...converted,
          plan: 'FREE',
          invitedBy: 'MOCK_USER_ID',
        });
        plan = 'FREE';
      }

      if (!serverInvite) {
        await updateServer({
          id: guild.id,
          serverInvite: await createServerInvite(guild),
        });
      }

      if (!plan) {
        logger.error("Server doesn't exist in the db", {
          guildId: guild.id,
          guildName: guild.name,
        });
        continue;
      }

      result[plan].push(guild);
    }

    const { FREE, PAID, OPEN_SOURCE } = result;

    return [...shuffle(PAID), ...shuffle(OPEN_SOURCE), ...shuffle(FREE)];
  } catch (err) {
    logger.error('Failed_to_randomize_guilds', {
      error: safeStringify(err),
    });
    return shuffle(guilds);
  }
}
