import { Link, createFileRoute } from "@tanstack/react-router"

import { formatPublishedAt, posts } from "@/features/blog/posts"

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog | Velumn" },
      {
        name: "description",
        content:
          "Notes on Discord discoverability, community publishing, and searchable support forums.",
      },
    ],
  }),
  component: BlogIndex,
})

function BlogIndex() {
  return (
    <main className="blog-main blog-shell">
      <p className="blog-eyebrow">Velumn blog</p>
      <h1 className="blog-title">Make community knowledge easier to find.</h1>
      <p className="blog-intro">
        Notes on Discord discoverability, community publishing, and building a
        useful archive from everyday conversations.
      </p>

      {posts.length > 0 ? (
        <ol className="blog-post-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <time dateTime={post.metadata.publishedAt}>
                  {formatPublishedAt(post.metadata.publishedAt)}
                </time>
                <Link
                  className="blog-post-link"
                  params={{ slug: post.slug }}
                  to="/blog/$slug"
                >
                  {post.metadata.title}
                </Link>
                <p className="blog-post-description">
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
