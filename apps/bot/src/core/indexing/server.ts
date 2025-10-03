import { getBulkServersPlan } from "@repo/db/helpers/servers";
import { ChannelType, GuildBasedChannel, type Client, type Guild } from "discord.js";
import { indexRootChannel } from "./channel";
import { Log } from "./logger";
import { shuffle } from "../../helpers/utils";
import { getBulkIndexingStatus } from "@repo/db/helpers/channels";

export async function indexServers(client: Client) {
  const allGuilds = [...client.guilds.cache.values()];
  const randomizedServers = await randomizeServers(allGuilds);

  for await (const guild of randomizedServers) {
    try {
      const channelsCahe = [...guild.channels.cache.values()];

      if (channelsCahe.length === 0) {
        Log("no_channels", guild);
        return;
      }

      const isIndexingEnabled = await getBulkIndexingStatus(channelsCahe.map(x => x.id));
      const isIndexingEnabledLookup = new Map(isIndexingEnabled.map(x => [x.id, x.indexingEnabled]))

      for await (const channel of channelsCahe) {
        if (!isChannelIndexable(channel) || channel.nsfw) continue;
        if (!isIndexingEnabledLookup.get(channel.id)) {
          Log("channel_indexing_disabled", channel)
          continue;
        };

        await indexRootChannel(channel);
      }
    } catch (error) {
      Log("failed_to_fetch_guild", error, guild);
    }
  }
}

const isChannelIndexable = (channel: GuildBasedChannel) =>
  channel.type === ChannelType.GuildText ||
  channel.type === ChannelType.GuildAnnouncement ||
  channel.type === ChannelType.GuildForum;


async function randomizeServers(allGuilds: Guild[]) {
  const guilds = allGuilds;

  try {
    const serversPlans = await getBulkServersPlan(guilds.map(x => x.id))
    const serverPlanLookup = new Map(serversPlans.map((x) => [x.id, x.plan]));

    const { FREE, PAID, OPEN_SOURCE } = guilds.reduce((acc, curr) => {
      if (!curr.id) return acc;
      const plan = serverPlanLookup.get(curr.id)!;

      if (!plan) {
        this.container.error("Server doesn't exist in the db");
        return acc;
      };

      acc[plan].push(curr);
      return acc;
    }, {
      FREE: [],
      PAID: [],
      OPEN_SOURCE: []
    } as Record<"FREE" | "OPEN_SOURCE" | "PAID", Guild[]>)

    return [
      ...shuffle(PAID),
      ...shuffle(OPEN_SOURCE),
      ...shuffle(FREE)
    ]
  } catch (err) {
    console.error("Failed_to_randomize_guilds", err)
    return shuffle(guilds);
  }
}
