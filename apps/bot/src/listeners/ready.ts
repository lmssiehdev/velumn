import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';
import type { Client } from 'discord.js';
import { indexServers } from '../core/indexing';

async function _testing(client: Client) {
  const guild = client.guilds.cache.get('1228579842212106302');
  if (!guild) {
    return;
  }
  const channel = await client.channels.fetch('1332813883995328613');

  if (!channel?.isTextBased()) {
    return;
  }

  const message = await channel.messages.fetch('1332813883995328613');
  console.log({ embeds: message.embeds });
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
    // await indexServers(client);
  }
}
