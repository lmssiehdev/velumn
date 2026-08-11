import { isIP } from "node:net";

export interface RateLimitResult {
	readonly allowed: boolean;
	readonly retryAfterSeconds: number;
}

export interface RateLimiter {
	readonly consume: (input: {
		readonly key: string;
		readonly limit: number;
		readonly windowMs: number;
	}) => Promise<RateLimitResult>;
}

interface RedisRateLimitClient {
	readonly incr: (key: string) => Promise<number>;
	readonly expire: (key: string, seconds: number) => Promise<number>;
	readonly send: (command: string, args: string[]) => Promise<unknown>;
}

export const makeRateLimiter = (
	client?: RedisRateLimitClient,
): RateLimiter => ({
	consume: async ({ key, limit, windowMs }) => {
		const redisClient = client ?? (await import("bun")).redis;
		const windowSeconds = Math.ceil(windowMs / 1000);
		const count = await redisClient.incr(key);
		if (count === 1) await redisClient.expire(key, windowSeconds);
		if (count <= limit) return { allowed: true, retryAfterSeconds: 0 };

		const ttl = Number(await redisClient.send("TTL", [key]));
		if (ttl > 0) return { allowed: false, retryAfterSeconds: ttl };

		// Repair a counter if its expiry was lost between INCR and EXPIRE.
		await redisClient.expire(key, windowSeconds);
		return { allowed: false, retryAfterSeconds: windowSeconds };
	},
});

export function normalizeIp(rawIp: string): string | undefined {
	let ip = rawIp.trim();
	if (!ip) return;
	if (ip === "::1") ip = "127.0.0.1";
	if (ip.startsWith("::ffff:")) ip = ip.slice("::ffff:".length);
	return isIP(ip) === 0 ? undefined : ip;
}

export function getTrustedClientIp({
	providedSecret,
	expectedSecret,
	propagatedIp,
}: {
	readonly providedSecret?: string;
	readonly expectedSecret: string;
	readonly propagatedIp?: string;
}): string | undefined {
	if (providedSecret !== expectedSecret || !propagatedIp) return;
	return normalizeIp(propagatedIp);
}
