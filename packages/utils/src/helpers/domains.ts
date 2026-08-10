function trimTrailingDot(value: string) {
	return value.endsWith(".") ? value.slice(0, -1) : value;
}

function ensureNoPathSearchOrHash(raw: string) {
	if (/[/?#]/.test(raw)) {
		throw new Error("Domain must not include a path, query string, or hash.");
	}
}

function normalizeHostname(hostname: string) {
	return trimTrailingDot(hostname.trim().toLowerCase());
}

export function normalizeHostHeader(host: string) {
	const [hostname] = host.trim().split(":");
	const normalizedHost = normalizeHostname(hostname ?? "");

	if (!normalizedHost) {
		throw new Error("Host header is required.");
	}

	return normalizedHost;
}

export function normalizeDomain(input: string) {
	const trimmed = input.trim();

	if (!trimmed) {
		throw new Error("Domain is required.");
	}

	const withScheme = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;
	const parsed = new URL(withScheme);

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("Domain must use HTTP or HTTPS.");
	}
	if (parsed.username || parsed.password || parsed.port) {
		throw new Error("Domain must not include credentials or a port.");
	}
	if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
		throw new Error("Domain must not include a path, query string, or hash.");
	}

	const normalized = normalizeHostname(parsed.hostname);
	ensureNoPathSearchOrHash(normalized);

	if (
		normalized === "localhost" ||
		normalized.startsWith("[") ||
		/^\d+\.\d+\.\d+\.\d+$/.test(normalized) ||
		normalized.startsWith("*.")
	) {
		throw new Error("Domain must be publicly routable.");
	}

	if (!/\./.test(normalized)) {
		throw new Error("Domain must be a valid hostname.");
	}
	if (
		normalized.length > 253 ||
		normalized
			.split(".")
			.some(
				(label) =>
					label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
			)
	) {
		throw new Error("Domain must be a valid hostname.");
	}

	return normalized;
}

export function buildHostUrl(host: string, path: string) {
	const normalizedHost = normalizeHostHeader(host);
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;

	return `https://${normalizedHost}${normalizedPath}`;
}
