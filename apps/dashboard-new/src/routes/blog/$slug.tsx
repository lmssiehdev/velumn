import { Link, createFileRoute, notFound } from "@tanstack/react-router"
import { ArrowUpRight, MessageCircle } from "lucide-react"

import {
  formatPublishedAt,
  getPost,
  getPostComponent,
} from "@/features/blog/posts"
import {
  blogImageUrl,
  blogUrl,
  buildBlogPostingScripts,
} from "@/features/blog/seo"
import { TableOfContents } from "@/features/blog/table-of-contents"

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPost(params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Article not found | Velumn" },
          { name: "robots", content: "noindex, nofollow" },
        ],
      }
    }

    const { metadata, slug } = loaderData
    const canonicalUrl = blogUrl(`/${encodeURIComponent(slug)}`)
    const imageUrl = blogImageUrl(metadata)

    return {
      meta: [
        { title: `${metadata.title} | Velumn` },
        { name: "description", content: metadata.description },
        { property: "og:type", content: "article" },
        { property: "og:title", content: metadata.title },
        { property: "og:description", content: metadata.description },
        { property: "og:url", content: canonicalUrl },
        { property: "og:site_name", content: "Velumn" },
        { property: "og:image", content: imageUrl },
        {
          property: "og:image:alt",
          content: metadata.thumbnailAlt ?? metadata.title,
        },
        {
          property: "article:published_time",
          content: metadata.publishedAt,
        },
        {
          property: "article:modified_time",
          content: metadata.updatedAt ?? metadata.publishedAt,
        },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: metadata.title },
        { name: "twitter:description", content: metadata.description },
        { name: "twitter:image", content: imageUrl },
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
      scripts: buildBlogPostingScripts(slug, metadata),
    }
  },
  component: BlogPost,
  notFoundComponent: BlogPostNotFound,
})

function BlogPost() {
  const post = Route.useLoaderData()
  const Post = getPostComponent(post.slug)
  if (!Post) throw notFound()

  return (
    <main className="blog-article">
      <article>
        <header className="blog-article__hero">
          <div className="blog-article__header blog-frame">
            <h1>{post.metadata.title}</h1>
            <div className="blog-article__byline">
              <span className="blog-article__author">Velumn team</span>
              <span>
                <time dateTime={post.metadata.publishedAt}>
                  {formatPublishedAt(post.metadata.publishedAt)}
                </time>
                {post.metadata.readTime ? ` · ${post.metadata.readTime}` : null}
              </span>
            </div>
            {post.metadata.thumbnail ? (
              <img
                alt={post.metadata.thumbnailAlt ?? post.metadata.title}
                className="blog-article__image"
                src={post.metadata.thumbnail}
              />
            ) : null}
          </div>
        </header>
        <div className="blog-article__body blog-frame">
          <div className="blog-prose prose prose-lg">
            <Post />
          </div>
          <TableOfContents />
        </div>
        <aside className="blog-cta blog-frame">
          <div className="blog-cta__icon">
            <MessageCircle aria-hidden="true" />
          </div>
          <h2>Your community already has answers worth finding.</h2>
          <p>
            Turn selected public threads into durable pages that keep helping,
            keep earning trust, and keep leading people back to Discord.
          </p>
          <div>
            <Link className="blog-cta__action" preload={false} to="/dashboard">
              Start free trial
              <ArrowUpRight aria-hidden="true" />
            </Link>
            <p className="blog-cta__note">7-day Pro trial. Cancel anytime.</p>
          </div>
        </aside>
      </article>
    </main>
  )
}

function BlogPostNotFound() {
  return (
    <main className="blog-not-found blog-shell">
      <h1>Article not found</h1>
      <p>The article may have moved or is not published.</p>
      <Link className="blog-link" to="/blog">
        Browse all posts
      </Link>
    </main>
  )
}
