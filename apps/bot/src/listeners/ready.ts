import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { ChannelType, type Client } from 'discord.js';
import { upsertServer } from '@repo/db/helpers/servers';
import { toDbChannel, toDbServer } from '../helpers/convertion';
import { upsertBulkChannels } from '@repo/db/helpers/channels';
import { indexServers } from '../core/indexing';

const guildId = "1385955477912948806";
const threadId = "1416262254482948218";
const messageId = "1419196211298308307";
async function testing(client: Client) {

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const converted = toDbServer(guild);
  await upsertServer(converted);

  // we save channels to display them in the onboarding flow
  const channels = await guild.channels.fetch();
  const channelsToIndex = channels.filter(x => x != null && (x.type === ChannelType.GuildText || x.type === ChannelType.GuildAnnouncement || x.type === ChannelType.GuildForum));

  const channelsToInsert = await Promise.all(channelsToIndex.map((x) => toDbChannel(x)));
  await upsertBulkChannels(channelsToInsert);
}

@ApplyOptions<Listener.Options>({
  once: true,
  event: Events.ClientReady,
  name: 'indexing-timer',
})
export class Indexing extends Listener {
  async run(client: Client) {
    // await testing(client);
    // return;
    // TODO: run this every day;
    await indexServers(client);
  }
}
