import { notFound } from "next/navigation";
import { BlogCTA } from "../_components/blog-cta";
import {
	formatPublishedAt,
	getAllPostSlugs,
	getPostBySlug,
} from "../_lib/posts";
import { BlogFooter } from "../Footer";

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

	return (
		<div>
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
							<img
								className="w-full h-full object-cover"
								src={metadata.thumbnail}
								alt={metadata.title}
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
