import { parseArgs } from 'node:util';
import { ApplyOptions } from '@sapphire/decorators';
import { container, Events, Listener } from '@sapphire/framework';
import { ChannelType, type Client } from 'discord.js';
import { toDBMessage, toDBSnapshot, toDbChannel, toDbServer } from '../helpers/convertion';
import { indexServers } from '../indexing';
import { fetchAllMessages } from '../indexing/helpers';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    index: { type: 'boolean' },
  },
});

@ApplyOptions<Listener.Options>({
  once: true,
  event: Events.ClientReady,
  name: 'indexing-timer',
})
export class Indexing extends Listener {
  async run(client: Client) {
    if (!values.index) {
      await testing(client);
      return;
    }

    // TODO: run this every day;
    await indexServers(client);
  }
}

const guilds = {
  namerio: '1228579842212106302',
  testserver: '1385955477912948806',
};

async function testing(client: Client) {
  container.logger.info('TESTING');
  const guild = client.guilds.cache.get(guilds.namerio);
  if (!guild) {
    return;
  }

  // const channel = await guild.channels.fetch('1416188980461830256');
  // if (channel?.type !== ChannelType.PublicThread) {
  //   return;
  // }

  const server = await toDbServer(guild);
  console.log({ server })
}
