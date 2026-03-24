import { Vercel } from "@vercel/sdk";
import type { GetDomainConfigResponseBody } from "@vercel/sdk/models/getdomainconfigop";
import type { GetProjectDomainResponseBody } from "@vercel/sdk/models/getprojectdomainop";
import { log } from "@/lib/log";
import { dashboardEnv } from "@/utils/env";

const REQUEST_TIMEOUT_MS = 15_000;

const vercel = new Vercel({
	bearerToken: dashboardEnv.VERCEL_BEARER_TOKEN,
});

const requestOptions = {
	timeoutMs: REQUEST_TIMEOUT_MS,
};

export type DNSRecord = {
	type: string;
	name: string;
	value: string;
	ttl?: number;
};

export type DomainCheckResult = {
	domain: string;
	verified: boolean;
	status: "valid_configuration" | "pending_verification" | "unhandled_error";
	message: string;
	dnsRecords: DNSRecord[];
};

export async function addProjectDomain(domain: string) {
	return await vercel.projects.addProjectDomain(
		{
			idOrName: dashboardEnv.VERCEL_PROJECT_ID,
			teamId: dashboardEnv.VERCEL_TEAM_ID,
			requestBody: {
				name: domain,
			},
		},
		requestOptions,
	);
}

export async function removeDomainFromProjectAndAccount(domain: string) {
	return await Promise.allSettled([
		vercel.projects.removeProjectDomain(
			{
				idOrName: dashboardEnv.VERCEL_PROJECT_ID,
				teamId: dashboardEnv.VERCEL_TEAM_ID,
				domain,
			},
			requestOptions,
		),
		vercel.domains.deleteDomain(
			{
				domain,
				teamId: dashboardEnv.VERCEL_TEAM_ID,
			},
			requestOptions,
		),
	]);
}

export async function getDomainStatus(
	domain: string,
): Promise<DomainCheckResult> {
	const [projectDomainResult, domainConfigResult] = await Promise.allSettled([
		vercel.projects.getProjectDomain(
			{
				idOrName: dashboardEnv.VERCEL_PROJECT_ID,
				teamId: dashboardEnv.VERCEL_TEAM_ID,
				domain,
			},
			requestOptions,
		),
		vercel.domains.getDomainConfig(
			{
				domain,
				projectIdOrName: dashboardEnv.VERCEL_PROJECT_ID,
				teamId: dashboardEnv.VERCEL_TEAM_ID,
			},
			requestOptions,
		),
		vercel.projects.verifyProjectDomain(
			{
				idOrName: dashboardEnv.VERCEL_PROJECT_ID,
				teamId: dashboardEnv.VERCEL_TEAM_ID,
				domain,
			},
			requestOptions,
		),
	]);

	if (projectDomainResult.status === "rejected") {
		log.error("dashboard_check_domain_failed", {
			area: "domains",
			domain,
			error: projectDomainResult.reason,
		});

		return {
			domain,
			verified: false,
			status: "unhandled_error",
			message: "Failed to fetch the current domain configuration.",
			dnsRecords: [],
		};
	}

	if (domainConfigResult.status === "rejected") {
		log.error("dashboard_check_domain_failed", {
			area: "domains",
			domain,
			error: domainConfigResult.reason,
		});

		return {
			domain,
			verified: false,
			status: "unhandled_error",
			message: "Failed to fetch the current domain configuration.",
			dnsRecords: [],
		};
	}

	const projectDomain = projectDomainResult.value;
	const domainConfig = domainConfigResult.value;
	const dnsRecords = [
		...toVerificationRecords(projectDomain.verification),
		...toMisconfigurationRecords(domain, projectDomain, domainConfig),
	];
	const verified =
		!dnsRecords.length && !domainConfig.misconfigured && projectDomain.verified;

	return {
		domain,
		verified,
		status: verified ? "valid_configuration" : "pending_verification",
		message: verified
			? "Domain is fully configured and ready to serve."
			: "Add the following DNS records to complete setup.",
		dnsRecords,
	};
}

function toVerificationRecords(
	records?: GetProjectDomainResponseBody["verification"],
) {
	return (records ?? []).map(
		(record): DNSRecord => ({
			name: record.domain,
			type: (record.type || "TXT").toUpperCase(),
			value: record.value,
		}),
	);
}

function toMisconfigurationRecords(
	domain: string,
	projectDomain: GetProjectDomainResponseBody,
	domainConfig: GetDomainConfigResponseBody,
) {
	if (!domainConfig.misconfigured) {
		return [];
	}

	const isApexDomain = projectDomain.apexName === domain;
	const recommendedIPv4 = domainConfig.recommendedIPv4[0]?.value[0];
	const recommendedCNAME = domainConfig.recommendedCNAME[0]?.value;

	if (recommendedIPv4 || recommendedCNAME) {
		return [
			{
				name: isApexDomain
					? "@"
					: projectDomain.name.replace(`.${projectDomain.apexName}`, ""),
				type: isApexDomain ? "A" : "CNAME",
				value: isApexDomain
					? (recommendedIPv4 ?? "76.76.21.21")
					: (recommendedCNAME ?? "cname.vercel-dns.com"),
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
