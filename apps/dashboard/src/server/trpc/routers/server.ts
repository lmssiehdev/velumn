import { setBulkIndexingStatus } from '@repo/db/helpers/channels';
import { createBotInvite, getChannelsInServer } from '@repo/db/helpers/servers';
import { updateAuthUser } from '@repo/db/helpers/user';
import { TRPCError } from '@trpc/server';
import { ChannelType } from 'discord-api-types/v10';
import { z } from 'zod';
import { parseError } from '@/lib/error';
import { log } from '@/lib/log';
import { privateProcedure, procedure, router } from '@/server/trpc';

export const serverRouter = router({
  public: procedure.query(() => {
    return { message: 'Hello world' };
  }),
  private: privateProcedure.query(() => {
    return { message: "I'm private" };
  }),
  finishOnboarding: privateProcedure
    .input(
      z.object({ userId: z.string(), selectedChannels: z.array(z.string()) })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const channels = input.selectedChannels.map((c) => ({
          channelId: c,
          status: true,
        }));
        await updateAuthUser(ctx.user.id, {
          finishedOnboarding: true,
        });
        await setBulkIndexingStatus(channels);
        return { success: true };
      } catch (err) {
        log.error('finish_onboarrding_failed', { err: parseError(err) });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to complete onboarding',
          cause: err,
        });
      }
    }),
  getChannelsInServer: privateProcedure
    .input(z.object({ serverId: z.string() }))
    .query(async ({ input }) => {
      const channels = await getChannelsInServer(input.serverId);
      if (!channels) {
        return { channels: [] };
      }
      return {
        channels: channels.map((c) => ({
          ...c,
          channelName: c.channelName ?? 'Unknown',
          enabled: c.type === ChannelType.GuildForum,
        })),
      };
    }),
  createServerInvite: privateProcedure
    .input(z.object({ serverId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await createBotInvite({
          serverId: input.serverId,
          userId: ctx.user.id,
        });
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=328565083201&scope=bot+applications.commands&guild_id=${input.serverId}&disable_guild_select=true`;

        return { inviteUrl };
      } catch (err) {
        log.error('create_bot_invite_failed', { err: parseError(err) });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create invite',
          cause: err,
        });
      }
    }),
});
