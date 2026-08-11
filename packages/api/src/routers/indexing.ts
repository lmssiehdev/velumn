import { z } from "zod";
import { unwrapIndexingResult } from "../errors";
import { protectedProcedure, router } from "../trpc";

const serverId = z.string().regex(/^\d{17,20}$/, "Invalid Discord snowflake");

export const indexingRouter = router({
	indexServer: protectedProcedure
		.input(
			z.object({
				serverId,
				maxThreads: z.number().int().min(0).max(30).default(15),
			}),
		)
		.mutation(async ({ input, ctx, signal }) =>
			unwrapIndexingResult(
				await ctx.operations.startGuildReconciliation(
					input.serverId,
					{ trigger: "index-server", maxThreads: input.maxThreads },
					signal,
				),
			),
		),
});
