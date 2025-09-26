import { parseArgs } from 'node:util';
import { upsertBulkChannels } from '@repo/db/helpers/channels';
import { upsertServer } from '@repo/db/helpers/servers';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import { ChannelType, type Client } from 'discord.js';
import { indexServers } from '../core/indexing';
import { toDbChannel, toDbServer } from '../helpers/convertion';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    index: { type: 'boolean' },
  },
});

const guilds = {
  namerio: '1228579842212106302',
  testserver: '1385955477912948806',
};

const guildId = '1385955477912948806';
const _threadId = '1416262254482948218';
const _messageId = '1419196211298308307';
async function testing(client: Client) {
  const guild = client.guilds.cache.get(guilds.namerio);
  if (!guild) {
    return;
  }

  const converted = toDbServer(guild);
  await upsertServer(converted);

  // we save channels to display them in the onboarding flow
  const channels = await guild.channels.fetch();
  const channelsToIndex = channels.filter(
    (x) =>
      x != null &&
      (x.type === ChannelType.GuildText ||
        x.type === ChannelType.GuildAnnouncement ||
        x.type === ChannelType.GuildForum)
  );

  const channelsToInsert = await Promise.all(
    channelsToIndex.map((x) => toDbChannel(x))
  );
  await upsertBulkChannels(channelsToInsert);
}

@ApplyOptions<Listener.Options>({
  once: true,
  event: Events.ClientReady,
  name: 'indexing-timer',
})
export class Indexing extends Listener {
  async run(client: Client) {
    if (values.index) {
      // TODO: run this every day;
      await indexServers(client);
    } else {
      await testing(client);
    }
  }
}
