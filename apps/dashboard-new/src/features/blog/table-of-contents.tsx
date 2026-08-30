// Tocbot owns DOM listeners and requires explicit mount/unmount lifecycle cleanup.
// eslint-disable-next-line no-restricted-imports
import { useEffect } from "react"
import tocbot from "tocbot"

export function TableOfContents() {
  useEffect(() => {
    tocbot.init({
      tocSelector: ".blog-toc__links",
      contentSelector: ".blog-prose",
      headingSelector: "h2, h3",
      orderedList: false,
      collapseDepth: 6,
      scrollSmooth: false,
      headingsOffset: 24,
    })

    return () => tocbot.destroy()
  }, [])

  return (
    <aside aria-label="On this page" className="blog-toc">
      <p className="blog-toc__label">On this page</p>
      <nav className="blog-toc__links" />
    </aside>
  )
}
