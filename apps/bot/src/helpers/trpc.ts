import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { sapphireClient } from "..";
import { botEnv } from "../config";
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

const protectedProcedure = t.procedure.use(isAuthenticated);

export const botRouter = t.router({
	health: protectedProcedure.query(() => {
		return "OK";
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

			if (!sapphireClient) {
				throw new TRPCError({
					code: "SERVICE_UNAVAILABLE",
					message: "Bot client not initialized",
				});
			}

			const guild = sapphireClient.guilds.cache.get(serverId);

			if (!guild) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Guild not found",
				});
			}

			indexServer(guild, { maxThreads });
			return { success: true };
		}),
});

export type BotRouter = typeof botRouter;

export const createContext = ({ req }: { req: Request }): Context => {
	return {
		secret: req.headers.get("x-velumn-secret") || undefined,
	};
};
