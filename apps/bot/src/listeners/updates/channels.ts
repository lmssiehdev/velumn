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

@ApplyOptions<Listener.Options>({
  event: Events.ThreadUpdate,
  name: 'update-channel',
})
export class UpdateChannel extends Listener {
  async run(_oldChannel: Channel, oldChannel: GuildChannel) {
    try {
      const channel = await findChannelById(oldChannel.id);
      if (!channel) {
        return;
      }
      await upsertChannel({
        create: channel,
        update: {
          id: oldChannel.id,
          channelName: oldChannel.name,
        },
      });
    } catch (error) {
      this.container.logger.error('Failed to delete channel', error);
    }
  }
}

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
  async run(_oldThread: ThreadChannel, newThread: ThreadChannel) {
    try {
      const channel = await findChannelById(newThread.id);
      if (!channel) {
        return;
      }
      await upsertChannel({
        create: channel,
        update: {
          id: newThread.id,
          channelName: newThread.name,
        },
      });
    } catch (error) {
      this.container.logger.error('Failed to delete channel', error);
    }
  }
}

// TODO: handle invites codes
