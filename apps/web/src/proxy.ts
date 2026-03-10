import { normalizeHostHeader } from "@repo/utils/helpers/domains";
import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
	const url = request.nextUrl;
	const host = request.headers.get("host");
	const pathname = url.pathname;

	if (pathname.startsWith("/og")) {
		return NextResponse.next();
	}

	if (isOnMainSite(host)) {
		return NextResponse.next();
	}

	const normalizedHost = normalizeHostHeader(host ?? "");
	url.pathname = `/${normalizedHost}${url.pathname}`;
	return NextResponse.rewrite(url);
}

function stripTrailingSlash(value: string) {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getBaseUrl(hostOverride?: string) {
	const siteUrl = process.env.NEXT_PUBLIC_BASE_URL;
	if (siteUrl) {
		return stripTrailingSlash(siteUrl);
	}

	if (process.env.NODE_ENV === "production") {
		return `https://${hostOverride ?? "www.velumn.com"}`;
	}

	return "http://localhost:3000";
}

export function getMainSiteHostname() {
	return new URL(getBaseUrl()).host;
}

export function isOnMainSite(host: string | null | undefined) {
	if (!host) {
		return false;
	}

	const normalizedHost = normalizeHostHeader(host);
	const mainHost = normalizeHostHeader(getMainSiteHostname());
	const bareMainHost = mainHost.startsWith("www.")
		? mainHost.slice(4)
		: mainHost;

	return (
		normalizedHost === mainHost ||
		normalizedHost === bareMainHost ||
		normalizedHost === "localhost" ||
		normalizedHost === "127.0.0.1" ||
		normalizedHost.endsWith(".vercel.app") ||
		normalizedHost.includes("ngrok-free.app")
	);
}

export const config = {
	matcher: ["/((?!api|auth|trpc|_next/static|_next/image|.*\\.png$|.svg).*)"],
};
