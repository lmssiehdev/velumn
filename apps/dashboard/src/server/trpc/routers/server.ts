import { setBulkIndexingStatus } from "@repo/db/helpers/channels";
import { createBotInvite, getChannelsInServer } from "@repo/db/helpers/servers";
import { updateAuthUser } from "@repo/db/helpers/user";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parseError } from "@/lib/error";
import { log } from "@/lib/log";
import { privateProcedure, router } from "@/server/trpc";
import type { BotRouter } from "../../../../../bot/src/helpers/trpc"; // Adjust path as needed

export const botClient = createTRPCClient<BotRouter>({
	links: [
		httpBatchLink({
			url: `${process.env.BOT_API_URL}/trpc`,
			headers: {
				"x-velumn-secret": process.env.DISCORD_BOT_TOKEN,
			},
		}),
	],
});
export const serverRouter = router({
	finishOnboarding: privateProcedure
		.input(
			z.object({
				payload: z.array(
					z.object({ channelId: z.string(), status: z.boolean() }),
				),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			try {
				const channels = input.payload;
				const result = await updateAuthUser(ctx.user.id, {
					finishedOnboarding: true,
				});
				if (!result?.serverId) {
					throw new Error("Server ID not found");
				}
				await setBulkIndexingStatus(channels);
				botClient.indexServer.mutate({ serverId: result.serverId });
				return { success: true };
			} catch (err) {
				log.error("finish_onboarrding_failed", { err: parseError(err) });

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to complete onboarding",
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
					channelName: c.channelName ?? "Unknown",
					enabled: c.indexingEnabled,
				})),
			};
		}),
	updateChannelsIndexingStatus: privateProcedure
		.input(
			z.object({
				payload: z.array(
					z.object({ channelId: z.string(), status: z.boolean() }),
				),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				await setBulkIndexingStatus(input.payload);
				return { success: true };
			} catch (err) {
				log.error("update_channels_indexing_status_failed", {
					err: parseError(err),
				});

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update channels indexing status",
					cause: err,
				});
			}
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
				log.error("create_bot_invite_failed", { err: parseError(err) });

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create invite",
					cause: err,
				});
			}
		}),
});
