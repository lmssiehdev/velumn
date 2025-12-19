import { updateDomainLinkToServer } from "@repo/db/helpers/domains";
import { getServerInfo } from "@repo/db/helpers/servers";
import { getAuthUser } from "@repo/db/helpers/user";
import { TRPCError } from "@trpc/server";
import { Vercel } from "@vercel/sdk";
import { domainsDeleteDomain } from "@vercel/sdk/funcs/domainsDeleteDomain.js";
import { projectsAddProjectDomain } from "@vercel/sdk/funcs/projectsAddProjectDomain.js";
import { projectsRemoveProjectDomain } from "@vercel/sdk/funcs/projectsRemoveProjectDomain.js";
import { z } from "zod";
import { parseError } from "@/lib/error";
import { privateProcedure, router } from "@/server/trpc";
import { logger } from "../../../../../../packages/logger/src/logger";

const idOrName = process.env.VERCEL_PROJECT_ID!;
const teamId = process.env.VERCEL_TEAM_ID;

const vercel = new Vercel({
	bearerToken: process.env.VERCEL_BEARER_TOKEN,
});

export type DNSRecord = {
	type: string;
	name: string;
	value: string;
	ttl?: number;
};

type DomainStatus =
	| {
			status: "unhandled_error" | "valid_configuration";
			message: string;
			dnsData: null;
	  }
	| {
			status: "pending_verification";
			dnsData: {
				type: "verification" | "misconfiguration";
				dnsRecord: DNSRecord;
			}[];
			message: string;
	  };

export const domainsRouter = router({
	addDomain: privateProcedure
		.input(z.object({ domain: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const authUser = await getAuthUser(ctx.user.id);

			if (!authUser?.serverId) {
				return { success: false, message: "No server linked" };
			}

			const server = await getServerInfo(authUser.serverId);

			if (server?.customDomain) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Server already has a domain linked",
				});
			}

			try {
				await projectsAddProjectDomain(vercel, {
					idOrName,
					teamId,
					requestBody: {
						name: input.domain,
					},
				});
				await updateDomainLinkToServer({
					serverId: authUser.serverId!,
					payload: {
						domainVerified: false,
						customDomain: input.domain,
					},
				});
				return { success: true };
			} catch (err) {
				logger.error("adding_domain_failed", {
					domain: input.domain,
					serverId: authUser.serverId,
					err: parseError(err),
				});

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to add domain to Vercel",
					cause: err,
				});
			}
		}),
	removeDomain: privateProcedure.mutation(async ({ ctx }) => {
		const authUser = await getAuthUser(ctx.user.id);

		if (!authUser?.serverId) {
			return { success: false, message: "No server linked" };
		}

		const server = await getServerInfo(authUser.serverId);

		if (!server?.customDomain) {
			return { success: false, message: "No custom domain linked" };
		}

		const results = await Promise.allSettled([
			projectsRemoveProjectDomain(vercel, {
				idOrName,
				teamId,
				domain: server.customDomain,
			}),
			domainsDeleteDomain(vercel, {
				domain: server.customDomain,
			}),
		]);

		results.forEach((result) => {
			if (result.status === "rejected") {
				// these might require manual deletion
				logger.error("deleting_domain_failed", {
					domain: server.customDomain,
					serverId: authUser.serverId,
					err: parseError(result.reason),
				});
			}
		});

		await updateDomainLinkToServer({
			serverId: authUser.serverId!,
			payload: {
				domainVerified: false,
				customDomain: null,
			},
		});

		return { success: true };
	}),
	checkDomain: privateProcedure.query(async ({ ctx }) => {
		const authUser = await getAuthUser(ctx.user.id);

		if (!authUser?.serverId) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "No server linked",
			});
		}

		const server = await getServerInfo(authUser.serverId);

		if (!server?.customDomain) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "No custom domain linked",
			});
		}

		return await checkAndVerifiyDomain(server.customDomain, {
			serverId: server.id,
		});
	}),
});

async function checkAndVerifiyDomain(
	domain: string,
	options: {
		serverId: string;
	},
): Promise<DomainStatus> {
	const [projectDomainRes, configRes] = await Promise.allSettled([
		vercel.projects.getProjectDomain({
			idOrName,
			teamId,
			domain,
		}),
		vercel.domains.getDomainConfig({
			teamId,
			domain,
		}),
		vercel.projects.verifyProjectDomain({
			idOrName,
			teamId,
			domain,
		}),
	]);

	console.log({
		projectDomainRes: projectDomainRes,
		configRes: configRes,
	});

	if (projectDomainRes.status === "rejected") {
		logger.error("project_domain_rejected", {
			domain,
			serverId: options.serverId,
			err: parseError(projectDomainRes.reason),
		});
		return {
			status: "unhandled_error",
			message: "Failed to fetch project domain",
			dnsData: null,
		};
	}
	if (configRes.status === "rejected") {
		logger.error("config_rejected", {
			domain,
			serverId: options.serverId,
			err: parseError(configRes.reason),
		});
		return {
			status: "unhandled_error",
			message: "Failed to fetch domain config",
			dnsData: null,
		};
	}

	const dnsData: DomainStatus["dnsData"] = [];

	const txtValue = projectDomainRes.value.verification?.at(0)?.value ?? null;

	if (txtValue) {
		dnsData.push({
			type: "verification",
			dnsRecord: {
				name: "_vercel",
				type: "TXT",
				value: txtValue,
			},
		});
	}

	if (configRes.value.misconfigured) {
		const _preferredIPv4 = configRes.value.recommendedIPv4.flatMap(
			(v) => v.value,
		);
		const _preferredCNAME = configRes.value.recommendedCNAME.flatMap(
			(v) => v.value,
		);

		const dnsRecord: DNSRecord =
			projectDomainRes.value.apexName === domain
				? {
						name: "@",
						type: "A",
						value: "76.76.21.21",
					}
				: {
						name: projectDomainRes.value.name.replace(
							`.${projectDomainRes.value.apexName}`,
							"",
						),
						type: "CNAME",
						value: "cname.vercel-dns.com",
					};

		dnsData.push({
			type: "misconfiguration",
			dnsRecord,
		});
	}

	if (!configRes.value.misconfigured && dnsData.length === 0) {
		return {
			status: "valid_configuration",
			message: "Domain is fully configured and ready to serve!",
			dnsData: null,
		};
	}

	return {
		status: "pending_verification",
		message: "Add the following DNS records to complete setup",
		dnsData: dnsData,
	};
}
