import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.context<Context>().create();
// Base router and procedure helpers
export const router = t.router;
export const procedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const privateProcedure = t.procedure.use(
	t.middleware(({ ctx, next }) => {
		if (!(ctx.session && ctx.user)) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You must be signed in to access this resource",
			});
		}

		return next({
			ctx: {
				...ctx,
				session: ctx.session,
				user: ctx.user, // Now guaranteed to exist
			},
		});
	}),
);
