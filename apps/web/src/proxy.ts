import { normalizeHostHeader } from "@repo/utils/helpers/domains";
import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
	const url = request.nextUrl;
	const host = request.headers.get("host");
	const pathname = url.pathname;
	const markdownRewrite = getMarkdownThreadRewrite(
		pathname,
		host,
		request.headers.get("accept"),
	);

	if (markdownRewrite) {
		url.pathname = markdownRewrite.pathname;
		return NextResponse.rewrite(url);
	}

	if (shouldBypassCustomDomainRewrite(pathname)) {
		return NextResponse.next();
	}

	if (isOnMainSite(host)) {
		return NextResponse.next();
	}

	const normalizedHost = normalizeHostHeader(host ?? "");
	url.pathname = `/${normalizedHost}${url.pathname}`;
	return NextResponse.rewrite(url);
}

const THREAD_PATH_REGEX = /^\/thread\/([^/]+)\/([^/]+?)(\.md)?\/?$/;

export function getMarkdownThreadRewrite(
	pathname: string,
	host: string | null | undefined,
	accept: string | null | undefined,
) {
	const threadMatch = pathname.match(THREAD_PATH_REGEX);

	if (!threadMatch) {
		return null;
	}

	const [, threadId, , markdownSuffix] = threadMatch;
	if (!markdownSuffix && !acceptsMarkdown(accept)) {
		return null;
	}

	const markdownPath = `/markdown/${threadId}`;
	if (isOnMainSite(host)) {
		return { pathname: markdownPath };
	}

	const normalizedHost = normalizeHostHeader(host ?? "");
	return {
		pathname: `/${normalizedHost}${markdownPath}`,
	};
}

export function acceptsMarkdown(accept: string | null | undefined) {
	if (!accept) {
		return false;
	}

	return accept.toLowerCase().includes("text/markdown");
}

function shouldBypassCustomDomainRewrite(pathname: string) {
	return isOgPath(pathname) || isSharedPublicAssetPath(pathname);
}

function isOgPath(pathname: string) {
	return pathname.startsWith("/og");
}

function isSharedPublicAssetPath(pathname: string) {
	return (
		pathname === "/favicon.ico" ||
		pathname === "/opengraph-image.png" ||
		pathname.startsWith("/icons/") ||
		pathname.startsWith("/assets/") ||
		pathname.startsWith("/fonts/") ||
		pathname === "/next.svg" ||
		pathname === "/vercel.svg" ||
		pathname === "/window.svg" ||
		pathname === "/globe.svg" ||
		pathname === "/file.svg"
	);
}

function stripTrailingSlash(value: string) {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getBaseUrl(hostOverride?: string) {
	const siteUrl = process.env.NEXT_PUBLIC_BASE_URL;
	if (siteUrl) {
		return stripTrailingSlash(siteUrl);
	}

	return `https://${hostOverride ?? "velumn.com"}`;
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
	matcher: [
		"/((?!api|auth|trpc|_next/static|_next/image).*)",
		"/robots.txt",
		"/sitemap.xml",
		"/sitemap.xml/:path*",
	],
};
