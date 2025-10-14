import { parseArgs } from 'node:util';
import { findLatestMessageInChannel } from '@repo/db/helpers/channels';
import { ApplyOptions } from '@sapphire/decorators';
import { container, Events, Listener } from '@sapphire/framework';
import { AnyThreadChannel, ChannelType, type Client } from 'discord.js';
import { indexServers } from '../core/indexing';
import {
  toDBMessage,
  toDBSnapshot,
  toDbChannel,
  toDbMetadata,
} from '../helpers/convertion';

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

  const channel = await guild.channels.fetch('1427089455797239811');
  if (channel?.type !== ChannelType.PublicThread) return;

  const message = await channel.messages.fetch('1427109258025238568');
  // console.log(await toDBMessage(await message.fetchReference()))
  console.log({ att: message.attachments });
  console.log(toDBSnapshot(message));
}

//
// for (const channel of guild.channels.cache.values()) {
//   if (
//     channel?.type !== ChannelType.GuildText
//   ) {
//     continue;
//   }

//   if (!channel.viewable) continue;
//   const threadCutoffId = await findLatestMessageInChannel(channel.id);
//   const archivedThreads: AnyThreadChannel[] = [];
//   const fetchAllArchivedThreads = async (before?: number | string) => {
//     const fetched = await channel.threads.fetchArchived({
//       type: 'public',
//       before,
//     });

//     const last = fetched.threads.last();
//     const isLastThreadOlderThanCutoff =
//       last && threadCutoffId && BigInt(last.id) < BigInt(threadCutoffId);

//     archivedThreads.push(...fetched.threads.values());

//     if (
//       !fetched.hasMore ||
//       !last ||
//       fetched.threads.size === 0 ||
//       isLastThreadOlderThanCutoff
//     ) {
//       return;
//     }
//     await fetchAllArchivedThreads(last.id);
//   };

//   await fetchAllArchivedThreads();
//   const activeThreads = await channel.threads.fetchActive();
//   const threads = [
//     ...archivedThreads.values(),
//     ...activeThreads.threads.values(),
//   ];

//   for (const thread of threads) {
//     console.log({ threadName: thread.name, threadId: thread.id });
//   }
// }
// console.log("Done indexing server", guild.name, guild.id);
// return;
