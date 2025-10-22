import { ChannelType } from 'discord.js';
import { sapphireClient } from '../..';
import { TEST_GUILDS } from '../../constants';
import { indexThread } from '../channel';

sapphireClient?.addListener('clientReady', async () => {
  await indexSpecificThread();
});

async function indexSpecificThread() {
  const guild = await sapphireClient?.guilds.fetch(TEST_GUILDS.T);

  if (!guild) {
    return;
  }

  const channel = await guild.channels.fetch('1420928866209497168');
  if (channel?.type !== ChannelType.PublicThread) {
    return;
  }

  const _r = await indexThread(channel, {
    skipIndexingEnabledCheck: true,
  });
}
