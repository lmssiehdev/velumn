import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import {
	absoluteUrl,
	buildBlogArticleMetadata,
	toDescription,
} from "@/lib/seo";
import { BlogCTA } from "../_components/blog-cta";
import {
	formatPublishedAt,
	getAllPostSlugs,
	getPostBySlug,
} from "../_lib/posts";
import { BlogFooter } from "../Footer";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const post = await getPostBySlug(slug);

	if (!post) {
		return {
			title: "Article not found",
			robots: {
				index: false,
				follow: false,
			},
		};
	}

	const canonicalUrl = absoluteUrl(`/blog/${slug}`);
	const description =
		toDescription(post.metadata.description, 160) ?? post.metadata.description;
	const imageUrl = post.metadata.thumbnail
		? absoluteUrl(post.metadata.thumbnail)
		: absoluteUrl("/opengraph-image.png");

	return buildBlogArticleMetadata({
		title: post.metadata.title,
		description,
		canonicalUrl,
		image: {
			url: imageUrl,
			alt: post.metadata.thumbnailAlt ?? post.metadata.title,
		},
		publishedTime: post.metadata.publishedAt,
		modifiedTime: post.metadata.updatedAt,
	});
}

export default async function Page({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const post = await getPostBySlug(slug);

	if (!post) {
		notFound();
	}

	const { default: Post, metadata } = post;
	const publishedAt = formatPublishedAt(metadata.publishedAt);
	const canonicalUrl = absoluteUrl(`/blog/${slug}`);
	const description =
		toDescription(metadata.description, 160) ?? metadata.description;
	const imageUrl = metadata.thumbnail
		? absoluteUrl(metadata.thumbnail)
		: absoluteUrl("/opengraph-image.png");

	return (
		<div>
			<ArticleJsonLd
				dateModified={metadata.updatedAt}
				datePublished={metadata.publishedAt}
				description={description}
				headline={metadata.title}
				image={imageUrl}
				url={canonicalUrl}
			/>
			<BreadcrumbJsonLd
				items={[
					{ name: "Home", item: absoluteUrl("/") },
					{ name: "Blog", item: absoluteUrl("/blog") },
					{ name: metadata.title, item: canonicalUrl },
				]}
			/>
			<div className="container mx-auto">
				<div className="mx-auto max-w-4xl grid grid-cols-1 gap-8 items-center p-6 sm:p-10">
					<div>
						<time
							dateTime={metadata.publishedAt}
							className="text-sm text-neutral-600 font-medium"
						>
							{publishedAt}
						</time>

						<h1 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 leading-tight">
							{metadata.title}
						</h1>

						<p className="mt-3 text-neutral-600">By Velumn's team</p>
					</div>

					{metadata.thumbnail ? (
						<div className="rounded-lg overflow-hidden shadow-xs">
							<Image
								alt={metadata.thumbnailAlt ?? metadata.title}
								className="w-full h-full object-cover"
								height={1444}
								src={metadata.thumbnail}
								width={2450}
							/>
						</div>
					) : null}
				</div>
			</div>
			<div>
				<main className="mx-auto prose prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl prose-h4:text-2xl prose-h5:text-xl prose-h6:text-lg dark:prose-headings:text-white">
					<Post />
				</main>
			</div>
			<div className="m-10">
				<BlogCTA />
			</div>
			<BlogFooter />
		</div>
	);
}

export function generateStaticParams() {
	return getAllPostSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;
