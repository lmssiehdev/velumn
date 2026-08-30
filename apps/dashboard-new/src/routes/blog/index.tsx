import { Link, createFileRoute } from "@tanstack/react-router"

import { formatPublishedAt, posts } from "@/features/blog/posts"
import { blogUrl } from "@/features/blog/seo"

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog | Velumn" },
      {
        name: "description",
        content:
          "Notes on Discord discoverability, community publishing, and searchable support forums.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Blog | Velumn" },
      {
        property: "og:description",
        content:
          "Notes on Discord discoverability, community publishing, and searchable support forums.",
      },
      { property: "og:url", content: blogUrl() },
      { property: "og:site_name", content: "Velumn" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: blogUrl() }],
  }),
  component: BlogIndex,
})

function BlogIndex() {
  return (
    <main className="blog-index blog-shell">
      <h1 className="blog-visually-hidden">Velumn blog</h1>
      {posts.length > 0 ? (
        <ol className="blog-post-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="blog-post-card">
                <p className="blog-post-card__meta">
                  <span>{post.metadata.category ?? "Field notes"}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={post.metadata.publishedAt}>
                    {formatPublishedAt(post.metadata.publishedAt)}
                  </time>
                  {post.metadata.readTime ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{post.metadata.readTime}</span>
                    </>
                  ) : null}
                </p>
                <h2>
                  <Link
                    className="blog-post-card__link"
                    params={{ slug: post.slug }}
                    to="/blog/$slug"
                  >
                    {post.metadata.title}
                  </Link>
                </h2>
                <p className="blog-post-card__description">
                  {post.metadata.description}
                </p>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="blog-empty">No posts published yet. Check back soon.</p>
      )}
    </main>
  )
}
