import { parseArgs } from 'node:util';
import { updateMessage } from '@repo/db/helpers/messages';
import { ApplyOptions } from '@sapphire/decorators';
import { container, Events, Listener } from '@sapphire/framework';
import { ChannelType, type Client, RESTJSONErrorCodes } from 'discord.js';
import { indexServers } from '../core/indexing';
import { toDBMessage } from '../helpers/convertion';

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
  const guild = client.guilds.cache.get(guilds.testserver);
  if (!guild) {
    return;
  }
  const channel = guild.channels.cache.get('1402284229332566098');
  if (
    channel?.type !== ChannelType.GuildText &&
    channel?.type !== ChannelType.PublicThread
  ) {
    return;
  }

  const message = await channel.messages.fetch('1414440815404781651');

  if (message.reference) {
    try {
      const repliedTo = await message.fetchReference();
      console.log(`Replying to: ${repliedTo.content}`);
    } catch (e) {
      if (e.code === RESTJSONErrorCodes.UnknownMessage) {
        console.log(`Message ${message.id} has been deleted`);
        return;
      }
      console.log("Couldn't fetch message", e);
    }
  }

  if (!message) {
    return;
  }

  for (const { data } of message.embeds) {
    console.log(data);
  }

  await updateMessage({
    ...(await toDBMessage(message)),
    id: '1416268121131712554',
    authorId: '180046139402354690',
  });
}
