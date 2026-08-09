import { redis } from "bun";
import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import {
	consumePublicSearchQuota as consumeQuota,
	normalizeIp,
} from "./search-quota";

export { getTrustedClientIp, normalizeIp } from "./search-quota";

const HOUR_IN_SECONDS = 3600;
const MINUTE_IN_SECONDS = 60;
const MAX_SEARCH_REQUESTS_PER_MINUTE = 30;

function parseForwardedFor(value: string): string | undefined {
	const [firstIp] = value.split(",");
	if (!firstIp) {
		return;
	}

	return normalizeIp(firstIp);
}

export function getHonoIp(c: Context): string | undefined {
	const forwardedFor = c.req.header("x-forwarded-for");
	if (forwardedFor) {
		const forwardedIp = parseForwardedFor(forwardedFor);
		if (forwardedIp) {
			return forwardedIp;
		}
	}

	try {
		const connInfo = getConnInfo(c);
		const ip = connInfo?.remote?.address;

		if (ip) {
			return normalizeIp(ip);
		}
	} catch {}
	return;
}

/**
 * Checks if the user has already voted on a thread
 * or more than 5 threads in an hour.
 */
export async function isRateLimited(threadId: string, ip?: string) {
	if (!ip) return true;

	const threadVoteKey = `vote:thread:${threadId}:ip:${ip}`;
	const alreadyVoted = await redis.get(threadVoteKey);

	if (alreadyVoted) {
		return true;
	}

	const votesInAnHour = `vote:hourly:${ip}`;
	const voteCount = await redis.get(votesInAnHour);

	return Number(voteCount ?? "0") >= 5;
}

export async function trackVote(threadId: string, ip?: string): Promise<void> {
	if (!ip) {
		return;
	}

	const threadVoteKey = `vote:thread:${threadId}:ip:${ip}`;
	await redis.set(threadVoteKey, "1");

	const votesInAnHour = `vote:hourly:${ip}`;
	const current = await redis.incr(votesInAnHour);

	if (current === 1) {
		await redis.expire(votesInAnHour, HOUR_IN_SECONDS); // 1 hour in seconds
	}
}

export async function isSearchRateLimited(ip?: string) {
	const searchWindowKey = `search:minute:ip:${ip ?? "unknown"}`;
	const searchCount = await redis.get(searchWindowKey);

	return !!searchCount && Number(searchCount) >= MAX_SEARCH_REQUESTS_PER_MINUTE;
}

export async function trackSearch(ip?: string): Promise<void> {
	const searchWindowKey = `search:minute:ip:${ip ?? "unknown"}`;
	const current = await redis.incr(searchWindowKey);

	if (current === 1) {
		await redis.expire(searchWindowKey, MINUTE_IN_SECONDS);
	}
}

export async function consumePublicSearchQuota(
	ip: string,
): ReturnType<typeof consumeQuota> {
	return consumeQuota(ip, redis);
}
