import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, ArrowUpRight, Check, GitFork } from "lucide-react"
import type { ReactNode } from "react"

import questrialUrl from "../assets/Questrial-Regular.ttf?url"
import marketingCss from "@/features/marketing/new-landing.css?url"

const title = "Velumn for Open-Source Communities"
const description =
  "Turn useful open-source Discord threads into public, searchable pages. Accepted projects get Velumn's full paid plan free."

export const Route = createFileRoute("/oss-program")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://velumn.com/oss-program" },
    ],
    links: [
      { rel: "stylesheet", href: marketingCss },
      { rel: "canonical", href: "https://velumn.com/oss-program" },
    ],
  }),
  component: OssProgramPage,
})

const eligibility = [
  {
    title: "Your source is public",
    description:
      "The project's source code is publicly available in a repository people can inspect.",
  },
  {
    title: "It uses an open-source license",
    description:
      "The repository is licensed under an OSI-approved open-source license.",
  },
  {
    title: "It is community-run, not commercial",
    description:
      "The project is not owned or primarily maintained by a for-profit company and does not generate revenue from paid products, hosting, support, or services.",
  },
  {
    title: "Your community is active on Discord",
    description:
      "Users, maintainers, or contributors regularly share useful project knowledge in your server.",
  },
  {
    title: "You maintain the repository",
    description:
      "You are an owner or maintainer who can represent the project and its community.",
  },
  {
    title: "The project is active",
    description:
      "The repository shows ongoing development and has an engaged user or contributor community.",
  },
] as const

function OssProgramPage() {
  return (
    <div className="oss-program-page antialiased">
      <style>{`
        @font-face{font-family:OssProgramQuestrial;src:url(${questrialUrl}) format("truetype");font-style:normal;font-weight:400;font-display:swap}
        @font-face{font-family:OssProgramQuestrialFallback;src:local(Arial);ascent-override:82.33%;descent-override:21.09%;line-gap-override:0%;size-adjust:99.6%}
        .oss-program-page{--primary:hsl(240 10% 14%);--primary-foreground:hsl(0 0% 98%);--ring:oklch(0.708 0 0);font-family:OssProgramQuestrial,OssProgramQuestrialFallback,sans-serif}
      `}</style>
      <a
        className="fixed top-3 left-3 z-50 -translate-y-16 rounded-md bg-[#20201e] px-4 py-2 text-sm text-white transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] focus:translate-y-0"
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
          <Hero />
          <ProgramOffer />
          <Eligibility />
          <FinalCTA />
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
        <div className="hidden items-center gap-7 text-sm text-[#56554f] md:flex">
          <a
            className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4 focus-visible:outline-none"
            href="#program"
          >
            What&apos;s included
          </a>
          <a
            className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4 focus-visible:outline-none"
            href="#eligibility"
          >
            Eligibility
          </a>
          <Link
            className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4 focus-visible:outline-none"
            to="/"
          >
            Product
          </Link>
        </div>
        <DiscordLink size="sm">
          Apply in Discord
          <ArrowUpRight />
        </DiscordLink>
      </nav>
    </div>
  )
}

function Hero() {
  return (
    <header className="relative border-b border-[#cbc9bf] px-5 pt-20 pb-20 sm:px-8 sm:pt-24 sm:pb-24 lg:px-12 lg:pt-28 lg:pb-32">
      <div className="mx-auto max-w-6xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#bdbbb1] bg-[#fffef9] px-3 py-1.5 text-xs text-[#4d4c47] shadow-[0_2px_8px_rgba(35,35,30,0.05)]">
          <GitFork aria-hidden="true" className="size-3.5 text-[#6a52dc]" />
          Velumn for open-source communities
        </div>
        <h1 className="mx-auto max-w-[1120px] text-5xl leading-[0.98] tracking-[-0.05em] text-balance sm:text-6xl lg:text-[5.25rem]">
          Make your Discord knowledge
          <br className="hidden lg:block" /> as open as your code.
        </h1>
        <p className="mx-auto mt-8 max-w-[720px] text-base leading-7 text-pretty text-[#64635d] sm:text-lg sm:leading-8">
          Independent, non-commercial open-source projects get Velumn&apos;s
          full paid plan free. Turn useful Discord threads into public,
          searchable pages that lead developers back to your community.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <DiscordLink size="lg">
            Apply in Discord
            <ArrowRight />
          </DiscordLink>
          <a
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm text-[#56554f] underline decoration-[#aaa89e] underline-offset-4 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4 focus-visible:outline-none"
            href="#eligibility"
          >
            Check eligibility
          </a>
        </div>
        <p className="mt-3 text-xs text-[#77766f]">
          Join the Velumn Discord and share your project repository.
        </p>
      </div>
    </header>
  )
}

function ProgramOffer() {
  return (
    <section
      className="scroll-mt-24 border-b border-[#cbc9bf] bg-[#20201e] px-5 py-24 text-white sm:px-8 sm:py-32 lg:px-12"
      id="program"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-[#b6ff69] uppercase">
            From conversation to public knowledge
          </p>
          <h2 className="mt-4 max-w-2xl text-4xl leading-[1.05] tracking-[-0.045em] text-balance sm:text-5xl">
            Answer in Discord. Help developers everywhere.
          </h2>
          <p className="mt-6 max-w-xl leading-7 text-pretty text-white/60 sm:text-lg">
            Velumn publishes selected support threads as lasting web pages and
            keeps every answer connected to its original community. Accepted
            projects receive the complete paid plan free.
          </p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-[#2b2b28] p-7 sm:p-9">
          <div className="flex items-end justify-between gap-6 border-b border-white/10 pb-7">
            <div>
              <p className="text-sm text-white/50">Complete Velumn plan</p>
              <p className="mt-2 text-4xl tracking-[-0.04em]">$0</p>
            </div>
            <span className="pb-1 text-sm text-white/45">
              for qualifying projects
            </span>
          </div>
          <ul className="mt-7 space-y-4 text-sm text-white/75">
            <li className="flex items-center gap-3">
              <Check aria-hidden="true" className="size-4 text-[#b6ff69]" />
              Custom domain
            </li>
            <li className="flex items-center gap-3">
              <Check aria-hidden="true" className="size-4 text-[#b6ff69]" />
              Unlimited indexed channels
            </li>
            <li className="flex items-center gap-3">
              <Check aria-hidden="true" className="size-4 text-[#b6ff69]" />
              Unlimited page views
            </li>
            <li className="flex items-center gap-3">
              <Check aria-hidden="true" className="size-4 text-[#b6ff69]" />
              Priority support
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

function Eligibility() {
  return (
    <section
      className="scroll-mt-24 border-b border-[#cbc9bf] px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
      id="eligibility"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="mb-4 text-xs font-medium tracking-[0.18em] text-[#b4542f] uppercase">
            Eligibility
          </p>
          <h2 className="text-4xl leading-[1.05] tracking-[-0.045em] text-balance sm:text-5xl">
            Who&apos;s eligible?
          </h2>
          <p className="mt-6 max-w-md leading-7 text-[#66655f]">
            We review each project to keep the program focused on active,
            genuinely open-source communities.
          </p>
        </div>
        <div>
          <ol className="border-t border-[#cbc9bf]">
            {eligibility.map((item, index) => (
              <li
                className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-[#cbc9bf] py-7 sm:grid-cols-[3.5rem_1fr] sm:py-8"
                key={item.title}
              >
                <span className="font-mono text-xs text-[#9a9890]">
                  0{index + 1}
                </span>
                <div className="max-w-2xl">
                  <h3 className="text-lg leading-7 sm:text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#696861]">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm leading-6 text-[#696861]">
            Building an open-source product as a business? The standard paid
            plan is the right fit.
          </p>
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="px-5 py-28 text-center sm:px-8 sm:py-40">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto mb-7 flex size-12 items-center justify-center rounded-2xl border border-[#b8b5aa] bg-[#fffef9] shadow-sm">
          <GitFork aria-hidden="true" className="size-6 text-[#6a52dc]" />
        </div>
        <h2 className="text-4xl leading-[1] tracking-[-0.05em] text-balance sm:text-6xl lg:text-7xl">
          Open up the answers your project already has.
        </h2>
        <p className="mx-auto mt-7 max-w-xl leading-7 text-pretty text-[#5e5d57] sm:text-lg">
          Join our Discord, share your repository, and ask us about the OSS
          program.
        </p>
        <div className="mt-9">
          <DiscordLink size="lg">
            Apply in Discord
            <ArrowUpRight />
          </DiscordLink>
        </div>
        <p className="mt-4 text-xs text-[#68647a]">
          Share your repository and tell us how your community uses Discord.
        </p>
      </div>
    </section>
  )
}

function DiscordLink({
  children,
  size,
}: {
  children: ReactNode
  size: "sm" | "lg"
}) {
  const sizeClasses =
    size === "lg"
      ? "h-10 rounded-md px-6 has-[>svg]:px-4 h-12 w-full px-6 text-base sm:w-auto"
      : "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5"

  return (
    <a
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium whitespace-nowrap text-primary-foreground shadow-xs transition-all outline-none hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 ${sizeClasses} rounded-full bg-[#20201e] font-semibold text-white shadow-none transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#393936] active:translate-y-0 active:scale-[0.96]`}
      href="/discord"
      rel="noopener"
      target="_blank"
    >
      {children}
    </a>
  )
}

function Footer() {
  return (
    <footer className="border-t border-[#cbc9bf] bg-[#20201e] text-white/65">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 border-x border-white/10 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="text-lg text-white">Velumn</span>
          <span>Help more people find your Discord community.</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Link
            className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e] focus-visible:outline-none"
            to="/"
          >
            Product
          </Link>
          <a
            className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e] focus-visible:outline-none"
            href="/discord"
            rel="noopener noreferrer"
            target="_blank"
          >
            Discord ↗
          </a>
          <a
            className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e] focus-visible:outline-none"
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
