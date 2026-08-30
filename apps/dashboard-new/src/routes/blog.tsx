import { Link, Outlet, createFileRoute } from "@tanstack/react-router"

import blogCss from "@/features/blog/blog.css?url"

export const Route = createFileRoute("/blog")({
  head: () => ({
    links: [{ rel: "stylesheet", href: blogCss }],
  }),
  component: BlogLayout,
})

function BlogLayout() {
  return (
    <div className="blog-surface">
      <header className="blog-header">
        <div className="blog-header__inner blog-shell">
          <Link className="blog-brand" to="/">
            Velumn
          </Link>
          <nav aria-label="Blog navigation" className="blog-nav">
            <Link to="/blog">All posts</Link>
            <Link className="blog-nav__cta" preload={false} to="/dashboard">
              Open Velumn
            </Link>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
