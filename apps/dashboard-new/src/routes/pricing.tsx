import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, ArrowUpRight, Check, GitFork } from "lucide-react"
import type { ReactNode } from "react"

import questrialUrl from "../assets/Questrial-Regular.ttf?url"
import marketingCss from "@/features/marketing/new-landing.css?url"
import { cn } from "@/lib/utils"

const title = "Simple Pricing for Searchable Discord Answers | Velumn"
const description =
  "Start publishing Discord threads for free. Upgrade to use your own domain and get priority support for $125 per month."

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://velumn.com/pricing" },
    ],
    links: [
      { rel: "stylesheet", href: marketingCss },
      { rel: "canonical", href: "https://velumn.com/pricing" },
    ],
  }),
  component: PricingPage,
})

const freeFeatures = [
  "Hosted on velumn.com",
  "Unlimited indexed channels",
  "Unlimited page views",
  "Public, searchable thread pages",
  "Community support",
] as const

const proFeatures = [
  "Everything in Free",
  "Your own custom domain",
  "Priority support",
] as const

function PricingPage() {
  return (
    <div
      className="min-h-screen bg-[#fefcf6] antialiased"
      style={{ fontFamily: '"Questrial", sans-serif' }}
    >
      <style>{`@font-face{font-family:"Questrial";src:url("${questrialUrl}") format("truetype");font-style:normal;font-weight:400;font-display:swap}`}</style>
      <a
        className="fixed top-3 left-3 z-50 -translate-y-16 rounded-md bg-[#20201e] px-4 py-2 text-sm text-white transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] focus:translate-y-0 motion-reduce:transition-none"
        href="#main-content"
      >
        Skip to content
      </a>
      <Navigation />
      <main
        className="min-h-screen overflow-hidden bg-[#f7f5ed] text-[#191918]"
        id="main-content"
      >
        <div className="mx-auto max-w-[1280px] border-x border-[#cbc9bf]">
          <Pricing />
          <TestimonialPreview />
          <OssProgram />
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Navigation() {
  return (
    <div className="border-b border-[#cbc9bf] bg-[#f7f5ed]/90 backdrop-blur-lg">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-[1280px] items-center justify-between border-x border-[#cbc9bf] px-4 sm:px-7"
      >
        <Link className="flex items-baseline gap-2" to="/">
          <span className="text-xl tracking-[-0.03em]">Velumn</span>
          <span className="rounded-full border border-[#cbc9bf] px-2 py-0.5 text-xs tracking-[0.14em] text-[#67665f] uppercase">
            Beta
          </span>
        </Link>
        <div className="hidden items-center gap-7 text-sm text-[#56554f] sm:flex">
          <Link className={navLinkClassName} to="/">
            Product
          </Link>
          <Link className={navLinkClassName} to="/oss-program">
            OSS program
          </Link>
        </div>
        <DashboardLink size="sm">
          Start free
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </DashboardLink>
      </nav>
    </div>
  )
}

function Pricing() {
  return (
    <section className="border-b border-[#cbc9bf] px-5 pt-20 pb-24 sm:px-8 sm:pt-28 sm:pb-32 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-6xl text-center">
          <p className="text-xs font-medium tracking-[0.18em] text-[#6a52dc] uppercase">
            Pricing
          </p>
          <h1 className="mx-auto mt-5 max-w-[1120px] text-5xl leading-[0.98] tracking-[-0.05em] text-balance sm:text-6xl lg:text-[5.25rem]">
            Turn Discord answers
            <br className="hidden lg:block" /> into public knowledge.
          </h1>
          <p className="mx-auto mt-7 max-w-[760px] text-base leading-7 text-pretty text-[#64635d] sm:text-lg sm:leading-8">
            Every plan includes the full publishing setup: unlimited indexed
            channels and page views, automatic syncing, and every answer linked
            back to Discord. Start free on Velumn, or upgrade for your own
            domain and priority support.
          </p>
          <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[#64635d]">
            <li className="flex items-center gap-2">
              <Check aria-hidden="true" className="size-4 text-[#527d22]" />
              7-day Pro trial
            </li>
            <li className="flex items-center gap-2">
              <Check aria-hidden="true" className="size-4 text-[#527d22]" />
              No credit card
            </li>
            <li className="flex items-center gap-2">
              <Check aria-hidden="true" className="size-4 text-[#527d22]" />
              Free plan available
            </li>
          </ul>
        </header>

        <div className="mx-auto mt-16 grid max-w-4xl gap-px overflow-hidden rounded-2xl border border-[#aaa89e] bg-[#aaa89e] md:grid-cols-2">
          <PlanCard
            description="For communities that want their answers on the web."
            features={freeFeatures}
            name="Free"
            price="Free"
          >
            <DashboardLink fullWidth size="lg" variant="outline">
              Start free
              <ArrowRight aria-hidden="true" className="size-4" />
            </DashboardLink>
          </PlanCard>
          <PlanCard
            description="For established communities that want publishing under their own brand."
            features={proFeatures}
            featured
            name="Pro"
            price="$125"
          >
            <DashboardLink fullWidth size="lg">
              Start 7-day trial
              <ArrowRight aria-hidden="true" className="size-4" />
            </DashboardLink>
          </PlanCard>
        </div>
      </div>
    </section>
  )
}

function PlanCard({
  children,
  description: planDescription,
  featured = false,
  features,
  name,
  price,
}: {
  children: ReactNode
  description: string
  featured?: boolean
  features: readonly string[]
  name: string
  price: string
}) {
  return (
    <article
      className={cn(
        "flex flex-col p-7 sm:p-9",
        featured ? "bg-[#e6e3ff]" : "bg-[#fffef9]"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl tracking-[-0.025em]">{name}</h2>
        {featured && (
          <span className="rounded-full bg-[#20201e] px-3 py-1 text-xs text-white">
            Full plan
          </span>
        )}
      </div>
      <div className="mt-8 flex items-end gap-2">
        <p className="text-5xl leading-none tracking-[-0.05em] tabular-nums">
          {price}
        </p>
        {price !== "Free" && (
          <span className="pb-1 text-sm text-[#68675f]">/ month</span>
        )}
      </div>
      <p className="mt-5 min-h-14 text-sm leading-6 text-pretty text-[#64635d]">
        {planDescription}
      </p>
      <div className="mt-7">{children}</div>
      <div className="mt-9 border-t border-[#c6c3b9] pt-8">
        <p className="text-sm font-medium">What&apos;s included</p>
        <ul className="mt-5 space-y-4 text-sm">
          {features.map((feature) => (
            <li className="flex items-start gap-3" key={feature}>
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[#527d22]"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

// Placeholder content for layout testing. Replace with a verified customer quote before production.
function TestimonialPreview() {
  return (
    <section className="border-b border-[#cbc9bf] bg-[#ffdaca] px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.4fr_1.6fr]">
        <p className="text-xs font-medium tracking-[0.18em] text-[#9a4525] uppercase">
          Customer story
        </p>
        <blockquote>
          <p className="text-3xl leading-[1.12] tracking-[-0.035em] text-balance text-[#38241d] sm:text-4xl">
            “We had years of community knowledge buried in Discord. Now our
            users can finally find it.”
          </p>
          <footer className="mt-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#20201e] text-sm text-white">
              T
            </div>
            <div className="text-sm">
              <cite className="text-[#38241d] not-italic">Tyler</cite>
              <p className="mt-0.5 text-[#825c4d]">
                Customer Success at CrownCards
              </p>
            </div>
          </footer>
        </blockquote>
      </div>
    </section>
  )
}

function OssProgram() {
  return (
    <section className="border-b border-[#cbc9bf] px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[#aaa89e] bg-[#20201e] p-7 text-white sm:p-12 lg:p-16">
        <div className="flex items-center justify-between gap-6">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/10">
            <GitFork aria-hidden="true" className="size-6" />
          </div>
          <span className="font-mono text-xs tracking-[0.14em] text-white/35 uppercase">
            Full Pro · $0
          </span>
        </div>
        <p className="mt-12 text-xs font-medium tracking-[0.18em] text-[#b6ff69] uppercase">
          Open-source program
        </p>
        <h2 className="mt-4 max-w-4xl text-4xl leading-[1.04] tracking-[-0.045em] text-balance sm:text-6xl">
          Velumn for open-source communities.
        </h2>
        <Link
          className="mt-9 inline-flex h-11 w-fit items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-[#20201e] transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#efede6] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e] focus-visible:outline-none active:translate-y-0 active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none"
          to="/oss-program"
        >
          Explore the OSS program
          <ArrowRight aria-hidden="true" className="size-6" />
        </Link>
      </div>
    </section>
  )
}

function DashboardLink({
  children,
  fullWidth = false,
  size,
  variant = "default",
}: {
  children: ReactNode
  fullWidth?: boolean
  size: "sm" | "lg"
  variant?: "default" | "outline"
}) {
  return (
    <a
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        variant === "default"
          ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
          : "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        size === "sm"
          ? "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5"
          : "h-10 rounded-md px-6 has-[>svg]:px-4",
        "rounded-full font-semibold shadow-none transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none",
        variant === "default" && "bg-[#20201e] text-white hover:bg-[#393936]",
        variant === "outline" &&
          "border-[#aaa89e] bg-white text-[#20201e] hover:bg-[#f1efe8] hover:text-[#20201e]",
        size === "lg" && "h-12 px-6 text-base",
        size === "lg" && (fullWidth ? "w-full" : "w-full sm:w-auto")
      )}
      href="/dashboard"
    >
      {children}
    </a>
  )
}

const navLinkClassName =
  "rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"

function Footer() {
  return (
    <footer className="border-t border-[#cbc9bf] bg-[#20201e] text-white/65">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 border-x border-white/10 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="text-lg text-white">Velumn</span>
          <span>Help more people find your Discord community.</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Link className={footerLinkClassName} to="/">
            Product
          </Link>
          <Link className={footerLinkClassName} to="/oss-program">
            OSS program
          </Link>
          <a
            className={footerLinkClassName}
            href="https://github.com/lmssiehdev/velumn"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub ↗
          </a>
        </div>
      </div>
    </footer>
  )
}

const footerLinkClassName =
  "rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e]"
