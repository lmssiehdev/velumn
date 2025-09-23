import { z } from 'zod';
import { procedure, router } from '@/server/trpc';
import { getChannelsInServer } from '@repo/db/helpers/servers';
import { ChannelType } from 'discord-api-types/v10';

// TODO: protect
export const serverRouter = router({
    getChannelsInServer: procedure
        .input(z.object({ serverId: z.string() }))
        .query(async ({ input }) => {
            const server = await getChannelsInServer(input.serverId);
            if (!server || !server.channels) {
                return { channels: [] };
            }
            return {
                channels: server.channels.map((c) => ({
                    id: c.id,
                    name: c.channelName ?? "Unknown",
                    type: c.type as ChannelType,
                    enabled: c.type === ChannelType.GuildForum,
                }))
            };
        }),
});
