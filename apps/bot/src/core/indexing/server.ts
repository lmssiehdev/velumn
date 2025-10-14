import { getBulkServersPlan, upsertServer } from '@repo/db/helpers/servers';
import {
  ChannelType,
  type Client,
  type Guild,
  type GuildBasedChannel,
} from 'discord.js';
import { logger, safeStringify } from '../../helpers/lib/log';
import { shuffle } from '../../helpers/utils';
import { indexRootChannel } from './channel';
import { Log } from './logger';
import { toDbServer } from '../../helpers/convertion';

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
      console.log("Done indexing server", guild.name, guild.id);
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
    process.env.NODE_END !== 'development'
      ? allGuilds
      : allGuilds.filter((x) => x.id === "1385955477912948806");

  try {
    const serversPlans = await getBulkServersPlan(guilds.map((x) => x.id));
    const serverPlanLookup = new Map(serversPlans.map((x) => [x.id, x.plan]));

    const result: Record<'FREE' | 'OPEN_SOURCE' | 'PAID', Guild[]> = {
      FREE: [],
      PAID: [],
      OPEN_SOURCE: [],
    };

    for (const curr of guilds) {
      if (!curr.id) {
        continue;
      }
      let plan = serverPlanLookup.get(curr.id)!;

      if (process.env.NODE_END === 'development') {
        const converted = toDbServer(curr);
        await upsertServer({
          ...converted,
          plan: "FREE",
          invitedBy: "MOCK_USER_ID",
        });
        plan = "FREE";
      }

      if (!plan) {
        logger.info("Server doesn't exist in the db");
        continue;
      }

      result[plan].push(curr);
    }

    const { FREE, PAID, OPEN_SOURCE } = result;

    return [...shuffle(PAID), ...shuffle(OPEN_SOURCE), ...shuffle(FREE)];
  } catch (err) {
    logger.error('Failed_to_randomize_guilds', {
      error: safeStringify(err)
    });
    return shuffle(guilds);
  }
}
