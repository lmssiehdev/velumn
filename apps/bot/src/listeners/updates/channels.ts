import {
  deleteChannel,
  findChannelById,
  upsertChannel,
} from '@repo/db/helpers/channels';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import {
  type Channel,
  Events,
  type GuildChannel,
  type ThreadChannel,
} from 'discord.js';
import { toDbChannel } from '../../helpers/convertion';

@ApplyOptions<Listener.Options>({
  event: Events.ChannelDelete,
  name: 'delete-channel',
})
export class DeleteChannel extends Listener {
  async run(channel: Channel) {
    try {
      await deleteChannel(channel.id);
    } catch (error) {
      this.container.logger.error('Failed to delete channel', error);
    }
  }
}

//
// Threads
//
@ApplyOptions<Listener.Options>({
  event: Events.ChannelUpdate,
  name: 'update-channel',
})
export class UpdateChannel extends Listener {
  async run(_, newChannel: GuildChannel) {
    try {
      const channel = await findChannelById(newChannel.id);
      if (!channel) {
        return;
      }
      await upsertChannel({
        create: channel,
        update: {
          id: newChannel.id,
          channelName: newChannel.name,
        },
      });
    } catch (error) {
      this.container.logger.error('Failed to update channel', error);
    }
  }
}

@ApplyOptions<Listener.Options>({
  event: Events.ThreadDelete,
  name: 'delete-thread',
})
export class ThreadDelete extends Listener {
  async run(thread: ThreadChannel) {
    try {
      await deleteChannel(thread.id);
    } catch (error) {
      this.container.logger.error('Failed to delete channel', error);
    }
  }
}

@ApplyOptions<Listener.Options>({
  event: Events.ThreadUpdate,
  name: 'update-thread',
})
export class UpdateThread extends Listener {
  async run(_, newThread: ThreadChannel) {
    try {
      const channelToUpdate = await toDbChannel(newThread);

      const { id, channelName, pinned } = channelToUpdate;

      await upsertChannel({
        create: channelToUpdate,
        update: { id, channelName, pinned },
      });
    } catch (error) {
      this.container.logger.error('Failed to delete channel', error);
    }
  }
}
