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

	if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
		throw new Error("Domain must not include a path, query string, or hash.");
	}

	const normalized = normalizeHostHeader(parsed.host);
	ensureNoPathSearchOrHash(normalized);

	if (normalized === "localhost" || normalized === "127.0.0.1") {
		throw new Error("Domain must be publicly routable.");
	}

	if (!/\./.test(normalized)) {
		throw new Error("Domain must be a valid hostname.");
	}

	return normalized;
}

export function buildHostUrl(host: string, path: string) {
	const normalizedHost = normalizeHostHeader(host);
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;

	return `https://${normalizedHost}${normalizedPath}`;
}
