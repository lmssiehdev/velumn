import { checkIfServerExistsForUser } from "@repo/db/helpers/servers";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { privateProcedure, router } from "@/server/trpc";
import type { DomainCheckResult } from "@/server/vercel-domains";

const DOMAIN_MIGRATION_MESSAGE =
	"Custom domain changes are temporarily unavailable while domain management is being migrated. Existing domain routing is unaffected.";

const domainInputSchema = z.object({
	serverId: z.string().min(1),
	domain: z.string().min(1),
});

const serverInputSchema = z.object({
	serverId: z.string().min(1),
});

export const domainsRouter = router({
	addDomain: privateProcedure
		.input(domainInputSchema)
		.mutation(async ({ input, ctx }): Promise<AddDomainResult> => {
			await authorizeServer(ctx.user.id, input.serverId);
			throwMigrationError();
		}),
	removeDomain: privateProcedure
		.input(serverInputSchema)
		.mutation(async ({ input, ctx }): Promise<RemoveDomainResult> => {
			await authorizeServer(ctx.user.id, input.serverId);
			throwMigrationError();
		}),
	checkDomain: privateProcedure
		.input(serverInputSchema)
		.query(async ({ input, ctx }): Promise<DomainCheckResult> => {
			await authorizeServer(ctx.user.id, input.serverId);
			throwMigrationError();
		}),
});

type AddDomainResult = {
	success: boolean;
	domain: string;
	domainVerified: boolean;
};

type RemoveDomainResult = {
	success: boolean;
};

async function authorizeServer(userId: string, serverId: string) {
	const ownedServer = await checkIfServerExistsForUser({
		userId,
		serverId,
	});

	if (!ownedServer?.server) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You don't have access to this server.",
		});
	}
}

function throwMigrationError(): never {
	throw new TRPCError({
		code: "PRECONDITION_FAILED",
		message: DOMAIN_MIGRATION_MESSAGE,
	});
}
