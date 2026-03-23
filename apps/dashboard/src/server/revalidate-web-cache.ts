import { CacheTags } from "@repo/utils/helpers/cache-keys";
import { log } from "@/lib/log";
import { dashboardEnv } from "@/utils/env";

const REVALIDATE_TIMEOUT_MS = 10_000;

async function postRevalidateRequest(
	url: string,
	payload: Record<string, unknown>,
) {
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			log.error("dashboard_revalidate_failed", {
				url,
				status: response.status,
				statusText: response.statusText,
				body: body.slice(0, 512),
			});
		}
	} catch (error) {
		log.error("dashboard_revalidate_failed", {
			url,
			error: error instanceof Error ? error.message : "unknown_error",
		});
	}
}

export async function revalidateDomainCaches(options: {
	serverId: string;
	domain?: string | null;
	previousDomain?: string | null;
}) {
	const tags = [
		CacheTags.server(options.serverId),
		options.domain ? CacheTags.serverByDomain(options.domain) : null,
		options.previousDomain
			? CacheTags.serverByDomain(options.previousDomain)
			: null,
	].filter((value): value is string => Boolean(value));

	if (!tags.length) {
		return;
	}

	await postRevalidateRequest(
		`${dashboardEnv.NEXT_PUBLIC_VELUMN_URL}/api/revalidate-tag`,
		{
			tags,
			secret: dashboardEnv.DISCORD_BOT_TOKEN,
		},
	);
}
