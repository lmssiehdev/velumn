import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import { getAllPosts } from "./_lib/posts";

export const metadata: Metadata = buildPageMetadata({
	title: "Discord SEO and Community Growth Blog",
	description:
		"Read Velumn's blog for insights on Discord discoverability, community SEO, indexed forums, and growing support communities through search.",
	canonicalUrl: absoluteUrl("/blog"),
});

export default async function BlogPage() {
	const posts = await getAllPosts();

	return (
		<div className="mx-auto max-w-5xl">
			<h1 className="text-3xl font-bold my-5">Blog Posts</h1>
			{posts.map((post) => (
				<article key={post.slug}>
					<Link href={`/blog/${post.slug}`}>
						<h2 className="text-xl underline">{post.metadata.title}</h2>
					</Link>
				</article>
			))}
		</div>
	);
}
