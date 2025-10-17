import type { Guild } from 'discord.js';
import { logger } from './lib/log';

export async function createServerInvite(guild: Guild) {
  const vanityURLCode = guild.vanityURLCode;
  if (vanityURLCode) {
    return vanityURLCode;
  }

  try {
    const channel =
      guild.systemChannel ||
      guild.rulesChannel ||
      guild.channels.cache.find(
        (ch) =>
          ch.isTextBased() &&
          ch.permissionsFor(guild.members.me!)?.has('CreateInstantInvite')
      );

    if (channel) {
      const invite = await guild.invites.create(channel.id, {
        maxAge: 0,
        maxUses: 0,
        unique: false,
        reason: 'used by velumn.com',
      });

      return invite.code;
    }

    // we check for existing invites first
    const existingInvites = await guild.invites.fetch();
    const permanentInvite = existingInvites.find(
      (invite) => invite.maxAge === 0 && invite.maxUses === 0
    );

    logger.error('No suitable channel found to create invite', {
      guildId: guild.id,
      guildName: guild.name,
    });

    if (permanentInvite) {
      return permanentInvite.url;
    }
    return;
  } catch (error) {
    logger.error('Failed to create invite', {
      error,
      guildId: guild.id,
      guildName: guild.name,
    });
    return;
  }
}
