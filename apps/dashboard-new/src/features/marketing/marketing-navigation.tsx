import { ArrowRight } from "lucide-react"

import { MarketingButton } from "./marketing-button"

const navLinks = [
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/oss-program", label: "OSS" },
  { href: "/blog", label: "Blog" },
] as const

export function MarketingNavigation() {
  return (
    <header className="mk-nav">
      <nav className="mk-shell mk-nav__inner" aria-label="Primary navigation">
        <a className="mk-brand" href="/" aria-label="Velumn home">
          <span aria-hidden="true">V</span>
          <strong>Velumn</strong>
          <small>Beta</small>
        </a>
        <div className="mk-nav__links">
          {navLinks.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </div>
        <MarketingButton href="/dashboard">
          Open dashboard <ArrowRight aria-hidden="true" />
        </MarketingButton>
      </nav>
    </header>
  )
}
