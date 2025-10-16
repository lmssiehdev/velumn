import { parseArgs } from 'node:util';
import { ApplyOptions } from '@sapphire/decorators';
import { container, Events, Listener } from '@sapphire/framework';
import { ChannelType, MessageType, type Client } from 'discord.js';
import {
  toDBMessage,
  toDBSnapshot,
  toDbChannel,
  toDbServer,
} from '../helpers/convertion';
import { indexServers } from '../indexing';
import { fetchAllMessages } from '../indexing/helpers';
import { TEST_GUILDS } from '../constants';

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

  const channel = await guild.channels.fetch('1426766340273995950');
  if (channel?.type !== ChannelType.PublicThread) {
    return;
  }

  const messages = await fetchAllMessages(channel);
  for (const msg of messages) {

    const message = await toDBMessage(msg);
    console.log(MessageType[message.type], message.content);
  }
}
