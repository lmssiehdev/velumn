import { initTRPC, TRPCError } from "@trpc/server";
import type { BotApiOperations } from "./contracts";
import type { RateLimiter } from "./rate-limit";

export interface ApiContext {
	readonly apiSecret: string;
	readonly secret?: string;
	readonly trustedClientIp?: string;
	readonly operations: BotApiOperations;
	readonly rateLimiter: RateLimiter;
}

const t = initTRPC.context<ApiContext>().create();

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
	if (ctx.secret !== ctx.apiSecret) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
	}
	return next();
});

export const trustedClientProcedure = protectedProcedure.use(
	({ ctx, next }) => {
		if (!ctx.trustedClientIp) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "A trusted client IP is required",
			});
		}
		return next({ ctx: { trustedClientIp: ctx.trustedClientIp } });
	},
);

export const enforceRateLimit = async (
	ctx: Pick<ApiContext, "rateLimiter">,
	input: {
		readonly key: string;
		readonly limit: number;
		readonly windowMs: number;
		readonly message: (retryAfterSeconds: number) => string;
	},
) => {
	const result = await ctx.rateLimiter.consume(input);
	if (!result.allowed) {
		throw new TRPCError({
			code: "TOO_MANY_REQUESTS",
			message: input.message(result.retryAfterSeconds),
		});
	}
};
