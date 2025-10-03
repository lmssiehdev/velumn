import { upsertBulkChannels } from '@repo/db/helpers/channels';
import { getUserWhoInvited, linkServerToUser, upsertServer } from '@repo/db/helpers/servers';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { ChannelType, Events, type Guild } from 'discord.js';
import { toDbChannel, toDbServer } from '../helpers/convertion';
import { resetUserServerIdLink, updateAuthUser } from '@repo/db/helpers/user';

@ApplyOptions<Listener.Options>({
  event: Events.GuildCreate,
  name: 'joined-guild',
})
export class JoinedGuild extends Listener {
  async run(guild: Guild) {
    try {
      // TODO: leave if no valid invite
      const invitedBy = await getUserWhoInvited(guild.id);

      if (!invitedBy) {
        this.container.logger.error(
          'Only invites from the dashboard are allowed'
        );
        return;
      }
      // TODO: handle blacklisted servers and leave if necessary;
      // TODO: handle invite code;
      const converted = toDbServer(guild);
      await upsertServer({
        ...converted,
        invitedBy: invitedBy?.userId,
      });

      // TODO: link the user with the server too;

      // we save channels to display them in the onboarding flow
      const channels = await guild.channels.fetch();
      const channelsToIndex = channels.filter(
        (x) =>
          x != null &&
          (x.type === ChannelType.GuildText ||
            x.type === ChannelType.GuildAnnouncement ||
            x.type === ChannelType.GuildForum)
      );


      // !! should probably be done in a transaction
      await linkServerToUser(guild.id, invitedBy.userId);
      const channelsToInsert = await Promise.all(
        channelsToIndex.map((x) => toDbChannel(x))
      );
      await upsertBulkChannels(channelsToInsert);
    } catch (error) {
      console.error('Error in JoinedGuild:', error);
    }
  }
}

// TODO: clean up message with a cron job
@ApplyOptions<Listener.Options>({
  event: Events.GuildDelete,
  name: 'left-guild',
})
export class LeftGuild extends Listener {
  async run(guild: Guild) {
    try {
      const converted = toDbServer(guild);
      await upsertServer({ ...converted, kickedAt: new Date() });
      await resetUserServerIdLink(guild.id);
    } catch (error) {
      this.container.logger.error('Failed to ', error);
    }
  }
}

@ApplyOptions<Listener.Options>({
  event: Events.GuildUpdate,
  name: 'guild-update',
})
export class SyncOnUpdate extends Listener {
  async run(_oldGuild: Guild, newGuild: Guild) {
    try {
      const converted = toDbServer(newGuild);
      await upsertServer(converted);
    } catch (error) {
      console.error('Error in SyncOnUpdate:', error);
    }
  }
}
