import { isIP } from "node:net";
import { redis } from "bun";
import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

export function getHonoIp(c: Context): string | undefined {
	const forwardedFor = c.req.header("x-forwarded-for");
	if (forwardedFor) {
		if (isIP(forwardedFor) !== 0) {
			return forwardedFor.includes("::ffff:")
				? forwardedFor.split("::ffff:")[1]
				: forwardedFor;
		}
	}

	try {
		const connInfo = getConnInfo(c);
		let ip = connInfo?.remote?.address;

		if (ip) {
			if (ip === "::1") {
				ip = "127.0.0.1";
			}

			if (ip.includes("::ffff:")) {
				ip = ip.split("::ffff:")[1];
			}

			if (ip && isIP(ip) !== 0) {
				return ip;
			}
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

	return voteCount && Number(voteCount) >= 5;
}

const HOUR_IN_SECONDS = 3600;
export async function trackVote(threadId: string, ip?: string): Promise<void> {
	const threadVoteKey = `vote:thread:${threadId}:ip:${ip}`;
	await redis.set(threadVoteKey, "1");

	const votesInAnHour = `vote:hourly:${ip}`;
	const current = await redis.incr(votesInAnHour);

	if (current === 1) {
		await redis.expire(votesInAnHour, HOUR_IN_SECONDS); // 1 hour in seconds
	}
}
