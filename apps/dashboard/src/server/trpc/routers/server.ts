import { createBotInvite, getChannelsInServer } from '@repo/db/helpers/servers';
import { ChannelType } from 'discord-api-types/v10';
import { z } from 'zod';
import { procedure, router } from '@/server/trpc';

// TODO: protect
export const serverRouter = router({
  public: procedure.query(() => {
    return { message: 'Hello world' };
  }),
  getChannelsInServer: procedure
    .input(z.object({ serverId: z.string() }))
    .query(async ({ input }) => {
      const channels = await getChannelsInServer(input.serverId);
      if (!channels) {
        return { channels: [] };
      }
      return {
        channels: channels.map((c) => ({
          id: c.id,
          name: c.channelName ?? 'Unknown',
          type: c.type as ChannelType,
          enabled: c.type === ChannelType.GuildForum,
        })),
      };
    }),
  createServerInvite: procedure
    .input(z.object({ serverId: z.string(), userId: z.string() }))
    .mutation(async ({ input }) => {
      await createBotInvite(input);
      const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=328565083201&scope=bot+applications.commands&guild_id=${input.serverId}&disable_guild_select=true`;
      return { inviteUrl };
    }),
});
