import { getServerInfoByDomain } from "@repo/db/helpers/servers";
import { buildHostUrl, normalizeHostHeader } from "@repo/utils/helpers/domains";
import { isOnMainSite } from "@/proxy";

export type RequestHostContext =
	| { type: "main"; host: string | null }
	| {
			type: "tenant";
			host: string;
			server: NonNullable<Awaited<ReturnType<typeof getServerInfoByDomain>>>;
	  };

export async function getRequestHostContext(
	host: string | null | undefined,
): Promise<RequestHostContext | null> {
	if (!host) {
		return { type: "main", host: null };
	}

	try {
		if (isOnMainSite(host)) {
			return { type: "main", host: normalizeHostHeader(host) };
		}

		const normalizedHost = normalizeHostHeader(host);
		const server = await getServerInfoByDomain(normalizedHost);

		if (!server) {
			return null;
		}

		return {
			type: "tenant",
			host: normalizedHost,
			server,
		};
	} catch {
		return null;
	}
}

export function getHostUrl(host: string, path: string) {
	return buildHostUrl(host, path);
}
