import { Code2 } from "lucide-react"

export function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-shell mk-footer__inner">
        <div>
          <a className="mk-footer__brand" href="/">
            Velumn
          </a>
          <p>Help more people find your Discord community.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/#product">Product</a>
          <a href="/pricing">Pricing</a>
          <a href="/oss-program">OSS</a>
          <a href="/blog">Blog</a>
          <a
            href="https://github.com/lmssiehdev/velumn"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 aria-hidden="true" /> GitHub
          </a>
        </nav>
      </div>
    </footer>
  )
}
