import { updateVote } from "@repo/db/helpers/channels";
import { apiLogger } from "@repo/logger";
import { initTRPC, TRPCError } from "@trpc/server";
import { redis } from "bun";
import { ChannelType, RESTJSONErrorCodes } from "discord.js";
import { z } from "zod";
import { sapphireClient } from "..";
import { botEnv } from "../config";
import { indexThread } from "../indexing/channel";
import { client, searchMessages } from "../indexing/search";
import { indexServer } from "../indexing/server";
import { toDBMessage } from "./convertion";
import { isRateLimited, trackVote } from "./rate-limit";

interface Context {
	secret?: string;
	ip?: string;
}

const t = initTRPC.context<Context>().create();

const isAuthenticated = t.middleware(({ ctx, next }) => {
	if (ctx.secret !== botEnv.DISCORD_BOT_TOKEN) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Forbidden",
		});
	}
	return next();
});

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(isAuthenticated);

export const botRouter = t.router({
	health: protectedProcedure.query(() => {
		return "OK";
	}),
	clear: publicProcedure.query(async () => {
		const keys = await redis.keys("*");
		return { keys };
	}),
	reindexServer: protectedProcedure
		.input(
			z.object({
				serverId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			if (!sapphireClient) {
				throw new TRPCError({
					code: "SERVICE_UNAVAILABLE",
					message: "Bot client not initialized",
				});
			}

			const guild = await sapphireClient.guilds.fetch(input.serverId);
			if (!guild) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Guild not found",
				});
			}

			indexServer(guild, {
				force: true,
			});
			return { success: true };
		}),
	reindexThread: protectedProcedure
		.input(
			z.object({
				serverId: z.string(),
				channelId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				if (!sapphireClient) {
					throw new TRPCError({
						code: "SERVICE_UNAVAILABLE",
						message: "Bot client not initialized",
					});
				}

				const guild = await sapphireClient.guilds.fetch(input.serverId);
				if (!guild) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Guild not found",
					});
				}

				const channel = await guild.channels.fetch(input.channelId);
				if (!channel) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Channel doesn't exist",
					});
				}

				// @ts-expect-error we filter inside the function
				await indexThread(channel, {
					fromMessageId: 0,
					skipIndexingEnabledCheck: true,
				});
				return { success: true };
			} catch (error) {
				apiLogger.error("reindexThread_failed", { error });
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to reindex thread",
					cause: error,
				});
			}
		}),
	getRawMessageData: protectedProcedure
		.input(
			z.object({
				serverId: z.string(),
				channelId: z.string(),
				messageId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				if (!sapphireClient) {
					throw new TRPCError({
						code: "SERVICE_UNAVAILABLE",
						message: "Bot client not initialized",
					});
				}
				const guild = await sapphireClient.guilds.fetch(input.serverId);
				if (!guild) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Guild not found",
					});
				}
				const channel = await guild.channels.fetch(input.channelId);
				if (!channel || channel.type !== ChannelType.PublicThread) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Channel is not a thread",
					});
				}
				const message = await channel.messages.fetch(input.messageId);
				if (!message) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Message not found",
					});
				}
				return toDBMessage(message);
			} catch (error) {
				apiLogger.error("getRawMessageData_failed", { error });
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get raw message data",
					cause: error,
				});
			}
		}),
	isBotInServer: protectedProcedure
		.input(
			z.object({
				serverId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			try {
				if (!sapphireClient) {
					throw new TRPCError({
						code: "SERVICE_UNAVAILABLE",
						message: "Bot client not initialized",
					});
				}

				const guild = await sapphireClient.guilds
					.fetch(input.serverId)
					.catch(() => null);

				return !!guild;
			} catch (error: unknown) {
				apiLogger.error("isBotInServer_failed", { error });
				if (
					(error as { code: RESTJSONErrorCodes })?.code ===
					RESTJSONErrorCodes.UnknownGuild
				) {
					return false;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to check if bot is in server",
					cause: error,
				});
			}
		}),
	meiliHealth: protectedProcedure.query(async ({ ctx }) => {
		try {
			const health = await client.health();
			const version = await client.getVersion();
			const index = client.index("discord-messages");
			const stats = await index.getStats();
			return {
				health: health.status,
				version: version.pkgVersion,
				numberOfDocuments: stats.numberOfDocuments,
				isIndexing: stats.isIndexing,
				ip: ctx.ip,
			};
		} catch (error) {
			apiLogger.error("meiliHealth_failed", { error });
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to check MeiliSearch health",
				cause: error,
			});
		}
	}),
	search: publicProcedure
		.input(
			z.object({
				serverId: z.string(),
				query: z.string(),
			}),
		)
		.query(async ({ input }) => {
			try {
				const results = await searchMessages(input);
				return results;
			} catch (error) {
				console.error("search_messages_failed", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to search messages",
					cause: error,
				});
			}
		}),
	indexServer: protectedProcedure
		.input(
			z.object({
				serverId: z.string(),
				maxThreads: z.number().max(30).default(15),
			}),
		)
		.mutation(async ({ input }) => {
			const { serverId, maxThreads } = input;
			try {
				if (!sapphireClient) {
					throw new TRPCError({
						code: "SERVICE_UNAVAILABLE",
						message: "Bot client not initialized",
					});
				}

				const guild = await sapphireClient.guilds.fetch(serverId);

				if (!guild) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Guild not found",
					});
				}

				indexServer(guild, { maxThreads });
				return { success: true };
			} catch (error) {
				apiLogger.error("index_server_failed", {
					serverId,
					error,
				});

				if (error instanceof TRPCError) {
					throw error;
				}

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "[API] Failed to index server",
					cause: error,
				});
			}
		}),
	updateVote: publicProcedure
		.input(
			z.object({
				threadId: z.string(),
				type: z.enum(["upvote", "downvote"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { threadId } = input;
			const ip = ctx.ip;

			if (await isRateLimited(threadId, ip)) {
				apiLogger.info("rate_limited_ip", { threadId, ip: ip });
				throw new TRPCError({
					code: "TOO_MANY_REQUESTS",
					message: "You're voting too quickly. Please slow down.",
				});
			}
			try {
				const result = await updateVote(threadId, input.type);
				if (result.rowCount === 0) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Thread not found",
					});
				}

				await trackVote(threadId, ip);
				return { success: true };
			} catch (error) {
				apiLogger.error("vote_on_thread_failed", {
					error,
					ip,
					...input,
				});
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to vote on thread",
				});
			}
		}),
});

export type BotRouter = typeof botRouter;

export const createContext = ({ req }: { req: Request }): Context => {
	return {
		secret: req.headers.get("x-velumn-secret") || undefined,
	};
};
