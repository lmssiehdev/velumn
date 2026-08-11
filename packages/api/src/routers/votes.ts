import { z } from "zod";
import { unwrapVoteResult } from "../errors";
import { enforceRateLimit, router, trustedClientProcedure } from "../trpc";

const hourMs = 3_600_000;
const snowflake = z
	.string()
	.regex(/^[1-9]\d{16,19}$/, "Invalid Discord snowflake")
	.refine(
		(value) => BigInt(value) <= 18_446_744_073_709_551_615n,
		"Invalid Discord snowflake",
	);

const voteProcedure = trustedClientProcedure
	.input(
		z.object({
			threadId: snowflake,
			type: z.enum(["upvote", "downvote"]),
		}),
	)
	.use(async ({ ctx, input, next }) => {
		await enforceRateLimit(ctx, {
			key: `vote:hour:${ctx.trustedClientIp}`,
			limit: 5,
			windowMs: hourMs,
			message: () => "You're voting too quickly. Please slow down.",
		});
		await enforceRateLimit(ctx, {
			key: `vote:thread:${input.threadId}:${ctx.trustedClientIp}`,
			limit: 1,
			windowMs: hourMs,
			message: () => "You've already voted on this thread recently.",
		});
		return next();
	});

export const votesRouter = router({
	updateVote: voteProcedure.mutation(async ({ input, ctx }) => {
		unwrapVoteResult(
			await ctx.operations.updateVote(input.threadId, input.type),
		);
		return { success: true };
	}),
});
