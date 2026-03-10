import { logger } from "@repo/logger";
import { botEnv } from "../config";

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
			const responseBody = await response.text().catch(() => "");
			logger.error("failed_to_invalidate_cache", {
				url,
				status: response.status,
				statusText: response.statusText,
				responseBody: responseBody.slice(0, 512),
			});
		}
	} catch (error) {
		logger.error("failed_to_invalidate_cache", { error, url });
	}
}

export async function invalidateTags(tags: string | string[]) {
	await postRevalidateRequest("https://velumn.com/api/revalidate-tag", {
		tags,
		secret: botEnv.DISCORD_BOT_TOKEN,
	});
}

export async function invalidatePath(path: string) {
	await postRevalidateRequest("https://velumn.com/api/revalidate-path", {
		path,
		secret: botEnv.DISCORD_BOT_TOKEN,
	});
}
