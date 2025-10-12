import { parseArgs } from 'node:util';
import { ApplyOptions } from '@sapphire/decorators';
import { container, Events, Listener } from '@sapphire/framework';
import {
  ChannelType,
  type Client,
  Message,
  RESTJSONErrorCodes,
} from 'discord.js';
import { emoji, optional, safeParse, z } from 'zod';
import { indexServers } from '../core/indexing';
import { isChannelIndexable } from '../core/indexing/server';
import { getEmojiData, toDbChannel, toDbMetadata } from '../helpers/convertion';
import { MessageLinkRegex } from '../helpers/regex';
import { indexRootChannel, indexTextBasedChannel } from '../core/indexing/channel';
import { text } from 'node:stream/consumers';

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
  const channel = guild.channels.cache.get('1385955478453882943');
  if (
    channel?.type !== ChannelType.GuildText &&
    channel?.type !== ChannelType.PublicThread
  ) {
    return;
  }

  const message = await channel.messages.fetch('1426763593558396959');

  if (!message) {
    return;
  }

  // TODO: save the display versoin
  function toDbPoll(message: Message) {
    if (!message.poll) return null;
    const answerSchema = z.object({
      text: z.string(),
      voteCount: z.number(),
    });
    const poll = message.poll;
    return {
      question: poll.question.text,
      answers: poll.answers.map(x => x).flatMap((a) => {
        const parsed = answerSchema.safeParse({ text: a.text, voteCount: a.voteCount, emoji: getEmojiData(a.emoji!) });
        if (!parsed.success) {
          console.error('Failed to parse poll data:', a);
          return [];
        }
        return [parsed.data];
      }),
    };
  }
  console.dir(toDbPoll(message), { depth: null })
}
