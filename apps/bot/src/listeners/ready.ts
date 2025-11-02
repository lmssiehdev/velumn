import { parseArgs } from 'node:util';
import { ApplyOptions } from '@sapphire/decorators';
import { container, Events, Listener } from '@sapphire/framework';
import { ChannelType, type Client } from 'discord.js';
import { TEST_GUILDS } from '../constants';
import { toDBMessage, toDbServer } from '../helpers/convertion';
import { indexServers } from '../indexing';
import { updateServer } from '@repo/db/helpers/servers';

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

async function testing(client: Client) {
  container.logger.info('TESTING');
  const guild = client.guilds.cache.get(TEST_GUILDS.T);
  if (!guild) {
    return;
  }
  const converted = toDbServer(guild);
  await updateServer(converted);
}
