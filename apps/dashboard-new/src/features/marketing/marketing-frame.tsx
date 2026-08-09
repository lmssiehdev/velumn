import type { ReactNode } from "react"

import { MarketingFooter } from "./marketing-footer"
import { MarketingNavigation } from "./marketing-navigation"

export function MarketingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-surface">
      <a className="mk-skip-link" href="#main-content">
        Skip to content
      </a>
      <MarketingNavigation />
      <div className="mk-shell mk-page">{children}</div>
      <MarketingFooter />
    </div>
  )
}
