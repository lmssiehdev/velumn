import { z } from "zod";
import { unwrapSearchResult } from "../errors";
import { formatPublicSearchResults } from "../search-format";
import { enforceRateLimit, router, trustedClientProcedure } from "../trpc";

const minuteMs = 60_000;
const snowflake = z
	.string()
	.regex(/^[1-9]\d{16,19}$/, "Invalid Discord snowflake")
	.refine(
		(value) => BigInt(value) <= 18_446_744_073_709_551_615n,
		"Invalid Discord snowflake",
	);

const publicSearchProcedure = trustedClientProcedure
	.input(
		z.object({
			serverId: snowflake,
			query: z.string().trim().min(1).max(120),
		}),
	)
	.use(async ({ ctx, next }) => {
		await enforceRateLimit(ctx, {
			key: `search:public:${ctx.trustedClientIp}`,
			limit: 20,
			windowMs: minuteMs,
			message: (retryAfter) =>
				`Search quota exceeded. Try again in ${retryAfter} seconds.`,
		});
		return next();
	});

export const searchRouter = router({
	searchPublic: publicSearchProcedure.query(async ({ input, ctx, signal }) =>
		formatPublicSearchResults(
			unwrapSearchResult(await ctx.operations.search(input, signal)),
		),
	),
});
