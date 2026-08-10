import { redis } from "bun";
import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import {
	consumePublicSearchQuota as consumeQuota,
	normalizeIp,
} from "./search-quota";

export { getTrustedClientIp } from "./search-quota";

const HOUR_IN_SECONDS = 3600;
const MINUTE_IN_SECONDS = 60;
const MAX_SEARCH_REQUESTS_PER_MINUTE = 30;

export function getHonoIp(context: Context): string | undefined {
	const forwardedFor = context.req.header("x-forwarded-for");
	const forwardedIp = forwardedFor?.split(",")[0];
	if (forwardedIp) {
		const normalized = normalizeIp(forwardedIp);
		if (normalized) return normalized;
	}
	try {
		const ip = getConnInfo(context)?.remote?.address;
		return ip ? normalizeIp(ip) : undefined;
	} catch {
		return;
	}
}

export async function isRateLimited(threadId: string, ip?: string) {
	if (!ip) return true;
	if (await redis.get(`vote:thread:${threadId}:ip:${ip}`)) return true;
	const voteCount = await redis.get(`vote:hourly:${ip}`);
	return Number(voteCount ?? "0") >= 5;
}

export async function trackVote(threadId: string, ip?: string): Promise<void> {
	if (!ip) return;
	await redis.set(`vote:thread:${threadId}:ip:${ip}`, "1");
	const hourlyKey = `vote:hourly:${ip}`;
	const current = await redis.incr(hourlyKey);
	if (current === 1) await redis.expire(hourlyKey, HOUR_IN_SECONDS);
}

export async function isSearchRateLimited(ip?: string) {
	const count = await redis.get(`search:minute:ip:${ip ?? "unknown"}`);
	return !!count && Number(count) >= MAX_SEARCH_REQUESTS_PER_MINUTE;
}

export async function trackSearch(ip?: string): Promise<void> {
	const key = `search:minute:ip:${ip ?? "unknown"}`;
	const current = await redis.incr(key);
	if (current === 1) await redis.expire(key, MINUTE_IN_SECONDS);
}

export async function consumePublicSearchQuota(ip: string) {
	return consumeQuota(ip, redis);
}
