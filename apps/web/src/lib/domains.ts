import type { DBServer } from "@repo/db/schema/discord";
import { buildHostUrl } from "@repo/utils/helpers/domains";
import { slugifyThreadUrl } from "@repo/utils/helpers/slugify";
import { getMainSiteHostname } from "@/proxy";

export function hasVerifiedCustomDomain(
	server: Pick<DBServer, "customDomain" | "domainVerified"> | null | undefined,
): server is Pick<DBServer, "customDomain" | "domainVerified"> & {
	customDomain: string;
} {
	return Boolean(server?.customDomain && server.domainVerified);
}

export function getMainSiteUrl(path: string) {
	return buildHostUrl(getMainSiteHostname(), path);
}

export function getCustomDomainUrl(
	server: Pick<DBServer, "customDomain">,
	path: string,
) {
	if (!server.customDomain) {
		throw new Error("Custom domain is required.");
	}

	return buildHostUrl(server.customDomain, path);
}

export function getThreadPath(threadId: string, threadName: string) {
	return slugifyThreadUrl({ id: threadId, name: threadName });
}
