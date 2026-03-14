import fs from "node:fs";
import path from "node:path";
import type { ComponentType } from "react";

export interface PostMetadata {
	title: string;
	description: string;
	publishedAt: string;
	updatedAt?: string;
	thumbnail?: string;
	thumbnailAlt?: string;
}

interface PostModule {
	default: ComponentType;
	metadata: PostMetadata;
}

function getContentDirectory() {
	return path.join(process.cwd(), "src", "content");
}

export function getAllPostSlugs() {
	const contentDir = getContentDirectory();
	return fs
		.readdirSync(contentDir)
		.filter((file) => file.endsWith(".mdx"))
		.map((file) => file.replace(".mdx", ""));
}

export async function getPostBySlug(slug: string) {
	const filePath = path.join(getContentDirectory(), `${slug}.mdx`);

	if (!fs.existsSync(filePath)) {
		return null;
	}

	return (await import(`@/content/${slug}.mdx`)) as PostModule;
}

export async function getAllPosts() {
	const posts = await Promise.all(
		getAllPostSlugs().map(async (slug) => {
			const { metadata } = (await import(
				`@/content/${slug}.mdx`
			)) as PostModule;
			return { slug, metadata };
		}),
	);

	return posts.sort(
		(a, b) =>
			new Date(b.metadata.publishedAt).getTime() -
			new Date(a.metadata.publishedAt).getTime(),
	);
}

export function formatPublishedAt(publishedAt: string) {
	const publishedDate = new Date(publishedAt);

	if (Number.isNaN(publishedDate.getTime())) {
		return publishedAt;
	}

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(publishedDate);
}
