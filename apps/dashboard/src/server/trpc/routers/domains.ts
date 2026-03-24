import {
	getServerByCustomDomain,
	updateDomainLinkToServer,
} from "@repo/db/helpers/domains";
import {
	checkIfServerExistsForUser,
	getServerInfo,
} from "@repo/db/helpers/servers";
import { normalizeDomain } from "@repo/utils/helpers/domains";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parseError } from "@/lib/error";
import { log } from "@/lib/log";
import { privateProcedure, router } from "@/server/trpc";
import {
	addProjectDomain,
	getDomainStatus,
	removeDomainFromProjectAndAccount,
} from "@/server/vercel-domains";
import { revalidateDomainCaches } from "../../revalidate-web-cache";

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
		.mutation(async ({ input, ctx }) => {
			const server = await getOwnedServer(ctx.user.id, input.serverId);
			const normalizedDomain = safeNormalizeDomain(input.domain);

			if (server.customDomain) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Server already has a custom domain linked.",
				});
			}

			const existingDomainOwner =
				await getServerByCustomDomain(normalizedDomain);
			if (existingDomainOwner && existingDomainOwner.id !== server.id) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This domain is already linked to another server.",
				});
			}

			try {
				await addProjectDomain(normalizedDomain);
			} catch (error) {
				log.error("dashboard_add_domain_failed", {
					serverId: server.id,
					domain: normalizedDomain,
					error: parseError(error),
				});

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to add the domain to Vercel.",
				});
			}

			try {
				await updateDomainLinkToServer({
					serverId: server.id,
					payload: {
						customDomain: normalizedDomain,
						domainVerified: false,
					},
				});

				await revalidateDomainCaches({
					serverId: server.id,
					domain: normalizedDomain,
				});
			} catch (error) {
				log.error("dashboard_add_domain_local_sync_failed", {
					serverId: server.id,
					domain: normalizedDomain,
					error: parseError(error),
				});
			}

			return {
				success: true,
				domain: normalizedDomain,
				domainVerified: false,
			};
		}),
	removeDomain: privateProcedure
		.input(serverInputSchema)
		.mutation(async ({ input, ctx }) => {
			const server = await getOwnedServer(ctx.user.id, input.serverId);
			const previousDomain = server.customDomain;

			if (!previousDomain) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No custom domain is linked to this server.",
				});
			}

			const [projectRemovalResult, accountDeletionResult] =
				await removeDomainFromProjectAndAccount(previousDomain);

			if (projectRemovalResult?.status === "rejected") {
				log.error("dashboard_remove_project_domain_failed", {
					serverId: server.id,
					domain: previousDomain,
					error: parseError(projectRemovalResult.reason),
				});

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to remove the domain from Vercel.",
				});
			}

			if (accountDeletionResult?.status === "rejected") {
				log.error("dashboard_delete_account_domain_failed", {
					serverId: server.id,
					domain: previousDomain,
					error: parseError(accountDeletionResult.reason),
				});
			}

			await updateDomainLinkToServer({
				serverId: server.id,
				payload: {
					customDomain: null,
					domainVerified: false,
				},
			});

			await revalidateDomainCaches({
				serverId: server.id,
				previousDomain,
			});

			return { success: true };
		}),
	checkDomain: privateProcedure
		.input(serverInputSchema)
		.query(async ({ input, ctx }) => {
			const server = await getOwnedServer(ctx.user.id, input.serverId);

			if (!server.customDomain) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No custom domain is linked to this server.",
				});
			}

			const result = await getDomainStatus(server.customDomain);

			try {
				await updateDomainLinkToServer({
					serverId: server.id,
					payload: {
						customDomain: server.customDomain,
						domainVerified: result.verified,
					},
				});

				await revalidateDomainCaches({
					serverId: server.id,
					domain: server.customDomain,
				});
			} catch (error) {
				log.error("dashboard_check_domain_local_sync_failed", {
					serverId: server.id,
					domain: server.customDomain,
					error: parseError(error),
				});
			}

			return result;
		}),
});

async function getOwnedServer(userId: string, serverId: string) {
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

	const server = await getServerInfo(serverId);
	if (!server) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Server not found.",
		});
	}

	return server;
}

function safeNormalizeDomain(domain: string) {
	try {
		return normalizeDomain(domain);
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				error instanceof Error ? error.message : "Please enter a valid domain.",
		});
	}
}
