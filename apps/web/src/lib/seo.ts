import type { Metadata } from "next";

export const SITE_NAME = "Velumn";
export const SITE_URL = "https://velumn.com";
export const SITE_TWITTER_HANDLE = "@velumn";
export const DEFAULT_OG_IMAGE_ALT = "Velumn social preview";
export const DEFAULT_SITE_DESCRIPTION =
	"Turn Discord channels into search-friendly forums that rank on Google, surface in AI tools, and help your community get discovered.";
export const ORGANIZATION_SAME_AS = [
	"https://github.com/lmssiehdev/velumn",
	"https://discord.gg/B23gNekHPy",
];

type SeoImage = {
	url: string;
	alt?: string;
	width?: number;
	height?: number;
};

type PageMetadataInput = {
	title: string;
	description: string;
	canonicalUrl: string;
	image?: SeoImage;
	robots?: Metadata["robots"];
	openGraphType?: "website" | "article";
};

type BlogArticleMetadataInput = PageMetadataInput & {
	publishedTime: string;
	modifiedTime?: string;
};

function stripTrailingSlash(value: string) {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function collapseWhitespace(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

function truncateAtWordBoundary(value: string, maxLength: number) {
	if (value.length <= maxLength) {
		return value;
	}

	const truncated = value.slice(0, maxLength - 1);
	const boundaryIndex = truncated.lastIndexOf(" ");
	return `${(boundaryIndex > 0 ? truncated.slice(0, boundaryIndex) : truncated).trim()}…`;
}

function resolveSeoImage(title: string, image?: SeoImage) {
	if (!image) {
		return buildDefaultOgImage(title);
	}

	return {
		url: image.url,
		alt: image.alt ?? `${title} social preview`,
		width: image.width ?? 1200,
		height: image.height ?? 630,
	};
}

export function getSiteUrl() {
	const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
	return stripTrailingSlash(envUrl || SITE_URL);
}

export function absoluteUrl(path: string) {
	return new URL(path, `${getSiteUrl()}/`).toString();
}

export function toDescription(
	text: string | null | undefined,
	maxLength = 160,
) {
	if (!text) {
		return undefined;
	}

	const collapsed = collapseWhitespace(text);
	if (!collapsed) {
		return undefined;
	}

	return truncateAtWordBoundary(collapsed, maxLength);
}

export function buildDefaultOgImage(alt = DEFAULT_OG_IMAGE_ALT) {
	return {
		url: absoluteUrl("/opengraph-image.png"),
		width: 1200,
		height: 630,
		alt,
	};
}

export function buildRobots({
	index = true,
	follow = true,
}: {
	index?: boolean;
	follow?: boolean;
} = {}) {
	return {
		index,
		follow,
	};
}

export function buildPageMetadata({
	title,
	description,
	canonicalUrl,
	image,
	robots,
	openGraphType = "website",
}: PageMetadataInput): Metadata {
	const seoImage = resolveSeoImage(title, image);

	return {
		title,
		description,
		alternates: {
			canonical: canonicalUrl,
		},
		openGraph: {
			title,
			description,
			type: openGraphType,
			url: canonicalUrl,
			siteName: SITE_NAME,
			images: [seoImage],
		},
		twitter: {
			card: "summary_large_image",
			site: SITE_TWITTER_HANDLE,
			title,
			description,
			images: [seoImage],
		},
		robots,
	};
}

export function buildDiscussionMetadata(input: PageMetadataInput): Metadata {
	return buildPageMetadata({
		...input,
		openGraphType: "article",
	});
}

export function buildBlogArticleMetadata({
	publishedTime,
	modifiedTime,
	...input
}: BlogArticleMetadataInput): Metadata {
	const baseMetadata = buildPageMetadata({
		...input,
		openGraphType: "article",
	});

	return {
		...baseMetadata,
		openGraph: {
			...baseMetadata.openGraph,
			type: "article",
			publishedTime,
			modifiedTime,
			authors: ["Velumn team"],
		},
	};
}
