import { apiLogger } from "@repo/logger";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { sapphireClient } from "..";
import { botEnv } from "../config";
import { client, searchMessages } from "../indexing/search";
import { indexServer } from "../indexing/server";

interface Context {
	secret?: string;
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
	meiliHealth: protectedProcedure.query(async () => {
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
				maxThreads: z.number().default(15),
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
});

export type BotRouter = typeof botRouter;

export const createContext = ({ req }: { req: Request }): Context => {
	return {
		secret: req.headers.get("x-velumn-secret") || undefined,
	};
};
