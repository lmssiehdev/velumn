import { Link, createFileRoute, notFound } from "@tanstack/react-router"

import {
  formatPublishedAt,
  getPost,
  getPostComponent,
} from "@/features/blog/posts"

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPost(params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.metadata.title} | Velumn` },
          {
            name: "description",
            content: loaderData.metadata.description,
          },
        ]
      : [
          { title: "Article not found | Velumn" },
          { name: "robots", content: "noindex, nofollow" },
        ],
  }),
  component: BlogPost,
  notFoundComponent: BlogPostNotFound,
})

function BlogPost() {
  const post = Route.useLoaderData()
  const Post = getPostComponent(post.slug)
  if (!Post) throw notFound()

  return (
    <main className="blog-article blog-shell">
      <Link className="blog-back-link" to="/blog">
        Back to all posts
      </Link>
      <article>
        <header>
          <time dateTime={post.metadata.publishedAt}>
            {formatPublishedAt(post.metadata.publishedAt)}
          </time>
          <h1>{post.metadata.title}</h1>
          <p className="blog-article__description">
            {post.metadata.description}
          </p>
        </header>
        <div className="blog-prose">
          <Post />
        </div>
      </article>
    </main>
  )
}

function BlogPostNotFound() {
  return (
    <main className="blog-not-found blog-shell">
      <h1>Article not found</h1>
      <p>The article may have moved or is not published.</p>
      <Link className="blog-back-link" to="/blog">
        Browse all posts
      </Link>
    </main>
  )
}
