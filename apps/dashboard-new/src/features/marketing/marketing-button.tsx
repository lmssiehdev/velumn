import type { ReactNode } from "react"

export function MarketingButton({
  children,
  href,
  size = "default",
}: {
  children: ReactNode
  href: string
  size?: "default" | "large"
}) {
  return (
    <a className={`mk-button mk-button--${size}`} href={href}>
      {children}
    </a>
  )
}
