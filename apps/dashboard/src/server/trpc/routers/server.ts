import { setBulkIndexingStatus } from "@repo/db/helpers/channels";
import {
	checkIfServerExistsForUser,
	createBotInvite,
	getAllThreads,
	getChannelsInServer,
} from "@repo/db/helpers/servers";
import { updateServerOnboarding } from "@repo/db/helpers/user";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { verifyServerOwnership } from "@/lib/authorization";
import { parseError } from "@/lib/error";
import { log } from "@/lib/log";
import { privateProcedure, router } from "@/server/trpc";
import { dashboardEnv } from "@/utils/env";
import type { BotRouter } from "../../../../../bot/src/helpers/trpc"; // Adjust path as needed

export const botClient = createTRPCClient<BotRouter>({
	links: [
		httpBatchLink({
			url: `${dashboardEnv.NEXT_PUBLIC_VELUMN_API_URL}/trpc`,
			headers: {
				"x-velumn-secret": dashboardEnv.DISCORD_BOT_TOKEN,
			},
		}),
	],
});

export const serverRouter = router({
	finishOnboarding: privateProcedure
		.input(
			z.object({
				serverId: z.string(),
				payload: z.array(
					z.object({ channelId: z.string(), status: z.boolean() }),
				),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const userServer = await checkIfServerExistsForUser({
				userId: ctx.user.id,
				serverId: input.serverId,
			});
			if (!userServer) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have access to this server",
				});
			}
			const { serverId, payload: channels } = input;

			await updateServerOnboarding(ctx.user.id, serverId, true);

			await setBulkIndexingStatus(channels);

			try {
				await botClient.indexServer.mutate({ serverId });
			} catch (err) {
				log.error("finish_onboarrding_failed", { err: parseError(err) });
				// TODO: schedule retry?
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to complete onboarding",
					cause: err,
				});
			}

			return { success: true };
		}),
	getChannelsInServer: privateProcedure
		.input(z.object({ serverId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userServer = await checkIfServerExistsForUser({
				userId: ctx.user.id,
				serverId: input.serverId,
			});
			if (!userServer) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have access to this server",
				});
			}
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
				serverId: z.string(),
				payload: z.array(
					z.object({ channelId: z.string(), status: z.boolean() }),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userServer = await checkIfServerExistsForUser({
				userId: ctx.user.id,
				serverId: input.serverId,
			});
			if (!userServer) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You don't have access to this server",
				});
			}
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
				const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${dashboardEnv.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=328565083201&scope=bot+applications.commands&guild_id=${input.serverId}&disable_guild_select=true`;

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
	checkIfServerExistsForUser: privateProcedure
		.input(z.object({ serverId: z.string() }))
		.query(async ({ input, ctx }) => {
			try {
				const result = await checkIfServerExistsForUser({
					userId: ctx.user.id,
					serverId: input.serverId,
				});
				return result !== undefined;
			} catch (err) {
				log.error("failed_to_check_if_server_exists", {
					err: parseError(err),
					input,
				});

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to check if server exists",
					cause: err,
				});
			}
		}),
	getServerThreads: privateProcedure
		.input(
			z.object({
				serverId: z.string(),
				pinned: z.boolean().optional(),
				page: z.number().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				const result = await verifyServerOwnership(ctx.user.id, input.serverId);

				if (!result.authorized) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: result.error || "You don't have access to this server",
					});
				}

				const threads = await getAllThreads("server", {
					id: input.serverId,
					pinned: input.pinned ?? false,
					page: input.page ?? 1,
				});
				return threads;
			} catch (err) {
				log.error("get_server_threads_failed", {
					err: parseError(err),
					input,
				});

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get server threads",
					cause: err,
				});
			}
		}),
});
