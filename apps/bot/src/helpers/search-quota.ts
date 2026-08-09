import { isIP } from "node:net";

const MINUTE_IN_SECONDS = 60;
const MAX_SEARCH_REQUESTS_PER_MINUTE = 30;

const consumeFixedWindowScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
if ttl < 0 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
if current <= tonumber(ARGV[2]) then
  return {1, 0}
end
return {0, ttl}
`;

export interface QuotaResult {
	readonly allowed: boolean;
	readonly retryAfterSeconds: number;
}

export interface RedisCommandSender {
	readonly send: (command: string, args: string[]) => Promise<unknown>;
}

export function normalizeIp(rawIp: string): string | undefined {
	let ip = rawIp.trim();

	if (!ip) {
		return;
	}

	if (ip === "::1") {
		ip = "127.0.0.1";
	}

	if (ip.startsWith("::ffff:")) {
		ip = ip.slice("::ffff:".length);
	}

	if (isIP(ip) === 0) {
		return;
	}

	return ip;
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
	if (providedSecret !== expectedSecret || !propagatedIp) {
		return;
	}

	return normalizeIp(propagatedIp);
}

export async function consumePublicSearchQuota(
	ip: string,
	client: RedisCommandSender,
): Promise<QuotaResult> {
	const normalizedIp = normalizeIp(ip);
	if (!normalizedIp) {
		return { allowed: false, retryAfterSeconds: MINUTE_IN_SECONDS };
	}

	const result = await client.send("EVAL", [
		consumeFixedWindowScript,
		"1",
		`search:public:minute:ip:${normalizedIp}`,
		String(MINUTE_IN_SECONDS),
		String(MAX_SEARCH_REQUESTS_PER_MINUTE),
	]);
	if (
		!Array.isArray(result) ||
		result.length !== 2 ||
		!Number.isFinite(Number(result[0])) ||
		!Number.isFinite(Number(result[1]))
	) {
		throw new Error("Redis returned an invalid public search quota result");
	}

	return {
		allowed: Number(result[0]) === 1,
		retryAfterSeconds: Math.max(0, Math.ceil(Number(result[1]))),
	};
}
