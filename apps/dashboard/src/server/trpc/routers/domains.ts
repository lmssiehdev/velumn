import { getServerByCustomDomain, updateDomainLinkToServer } from "@repo/db/helpers/domains";
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
import { dashboardEnv } from "@/utils/env";
import { revalidateDomainCaches } from "../../revalidate-web-cache";

const domainInputSchema = z.object({
	serverId: z.string().min(1),
	domain: z.string().min(1),
});

const serverInputSchema = z.object({
	serverId: z.string().min(1),
});

export type DNSRecord = {
	type: string;
	name: string;
	value: string;
	ttl?: number;
};

type DomainCheckResult = {
	domain: string;
	verified: boolean;
	status: "valid_configuration" | "pending_verification" | "unhandled_error";
	message: string;
	dnsRecords: DNSRecord[];
};

type ProjectDomainVerificationRecord = {
	type?: string;
	domain?: string;
	value?: string;
};

type ProjectDomainResponse = {
	name: string;
	apexName: string;
	verified?: boolean;
	verification?: ProjectDomainVerificationRecord[];
};

type VercelRecommendedRecord = {
	name?: string;
	type?: string;
	value?: string;
};

type DomainConfigResponse = {
	misconfigured?: boolean;
	recommendedIPv4?: VercelRecommendedRecord[];
	recommendedCNAME?: VercelRecommendedRecord[];
};

type VerifyDomainResponse = {
	verified?: boolean;
};

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

			const existingDomainOwner = await getServerByCustomDomain(normalizedDomain);
			if (existingDomainOwner && existingDomainOwner.id !== server.id) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This domain is already linked to another server.",
				});
			}

			try {
				await vercelRequest(
					`/v10/projects/${encodeURIComponent(dashboardEnv.VERCEL_PROJECT_ID)}/domains`,
					{
						method: "POST",
						body: JSON.stringify({
							name: normalizedDomain,
						}),
					},
				);

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

				return {
					success: true,
					domain: normalizedDomain,
				};
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

			const results = await Promise.allSettled([
				vercelRequest(
					`/v9/projects/${encodeURIComponent(dashboardEnv.VERCEL_PROJECT_ID)}/domains/${encodeURIComponent(previousDomain)}`,
					{
						method: "DELETE",
					},
				),
				vercelRequest(`/v6/domains/${encodeURIComponent(previousDomain)}`, {
					method: "DELETE",
				}),
			]);

			for (const result of results) {
				if (result.status === "rejected") {
					log.error("dashboard_remove_domain_failed", {
						serverId: server.id,
						domain: previousDomain,
						error: parseError(result.reason),
					});
				}
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

			const result = await checkAndVerifyDomain(server.customDomain);

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

async function checkAndVerifyDomain(domain: string): Promise<DomainCheckResult> {
	try {
		const [projectDomain, domainConfig, verifyResult] = await Promise.all([
			vercelRequest<ProjectDomainResponse>(
				`/v9/projects/${encodeURIComponent(dashboardEnv.VERCEL_PROJECT_ID)}/domains/${encodeURIComponent(domain)}`,
			),
			vercelRequest<DomainConfigResponse>(
				`/v6/domains/${encodeURIComponent(domain)}/config`,
				{
					query: {
						projectIdOrName: dashboardEnv.VERCEL_PROJECT_ID,
					},
				},
			),
			vercelRequest<VerifyDomainResponse>(
				`/v9/projects/${encodeURIComponent(dashboardEnv.VERCEL_PROJECT_ID)}/domains/${encodeURIComponent(domain)}/verify`,
				{
					method: "POST",
				},
			),
		]);

		const dnsRecords = [
			...toVerificationRecords(projectDomain.verification),
			...toMisconfigurationRecords(domain, projectDomain, domainConfig),
		];
		const verified =
			!dnsRecords.length &&
			!domainConfig.misconfigured &&
			Boolean(
				verifyResult.verified ??
					projectDomain.verified ??
					projectDomain.verification?.length === 0,
			);

		return {
			domain,
			verified,
			status: verified ? "valid_configuration" : "pending_verification",
			message: verified
				? "Domain is fully configured and ready to serve."
				: "Add the following DNS records to complete setup.",
			dnsRecords,
		};
	} catch (error) {
		log.error("dashboard_check_domain_failed", {
			domain,
			error: parseError(error),
		});

		return {
			domain,
			verified: false,
			status: "unhandled_error",
			message: "Failed to fetch the current domain configuration.",
			dnsRecords: [],
		};
	}
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

function toVerificationRecords(records?: ProjectDomainVerificationRecord[]) {
	return (records ?? [])
		.filter((record) => record.value)
		.map(
			(record): DNSRecord => ({
				name: record.domain ?? "_vercel",
				type: (record.type ?? "TXT").toUpperCase(),
				value: record.value!,
			}),
		);
}

function toMisconfigurationRecords(
	domain: string,
	projectDomain: ProjectDomainResponse,
	domainConfig: DomainConfigResponse,
) {
	if (!domainConfig.misconfigured) {
		return [];
	}

	const isApexDomain = projectDomain.apexName === domain;
	const recommendedRecord = isApexDomain
		? domainConfig.recommendedIPv4?.[0]
		: domainConfig.recommendedCNAME?.[0];

	if (recommendedRecord?.value) {
		return [
			{
				name: recommendedRecord.name ?? (isApexDomain ? "@" : domain),
				type: (recommendedRecord.type ?? (isApexDomain ? "A" : "CNAME")).toUpperCase(),
				value: recommendedRecord.value,
			},
		];
	}

	return [
		{
			name: isApexDomain
				? "@"
				: projectDomain.name.replace(`.${projectDomain.apexName}`, ""),
			type: isApexDomain ? "A" : "CNAME",
			value: isApexDomain ? "76.76.21.21" : "cname.vercel-dns.com",
		},
	];
}

async function vercelRequest<T>(
	pathname: string,
	options?: {
		method?: "GET" | "POST" | "DELETE";
		body?: string;
		query?: Record<string, string | undefined>;
	},
) {
	const query = new URLSearchParams();
	if (dashboardEnv.VERCEL_TEAM_ID) {
		query.set("teamId", dashboardEnv.VERCEL_TEAM_ID);
	}

	for (const [key, value] of Object.entries(options?.query ?? {})) {
		if (value) {
			query.set(key, value);
		}
	}

	const url = new URL(`https://api.vercel.com${pathname}`);
	if ([...query.keys()].length > 0) {
		url.search = query.toString();
	}

	const response = await fetch(url, {
		method: options?.method ?? "GET",
		headers: {
			Authorization: `Bearer ${dashboardEnv.VERCEL_BEARER_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: options?.body,
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => "");
		throw new Error(
			`Vercel API request failed (${response.status}): ${errorBody.slice(0, 512)}`,
		);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}
