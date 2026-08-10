import { Collapsible } from "@base-ui/react/collapsible"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  ArrowUpRight,
  AudioWaveform,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Globe2,
  MessageCircle,
  MessagesSquare,
  Mic,
  Plus,
  Search,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"

export const faqItems = [
  {
    question: "What happens after I connect Discord?",
    answer:
      "Choose the channels you want to publish. Velumn turns their public threads into readable web pages, keeps edits and deletions in sync, and links every page back to the original Discord conversation.",
  },
  {
    question: "Does this replace Discord with another forum?",
    answer:
      "No. Your members keep asking, answering, and participating in Discord. Velumn gives selected public threads a companion website so people outside your server can discover them.",
  },
  {
    question: "What content becomes public?",
    answer:
      "You choose which channels Velumn indexes. It publishes public-thread content the bot can access rather than mirroring every message in your server. Public pages omit Discord avatars and tags, and members can anonymize their displayed names.",
  },
  {
    question: "Can I publish on my own domain?",
    answer:
      "Yes. You can connect a verified custom domain so your community knowledge lives under your own brand, with its own canonical URLs and sitemap.",
  },
] as const

const featureCards = [
  {
    title: "Get found beyond Discord",
    description:
      "Give selected public threads readable pages with search-friendly metadata and stable URLs.",
    icon: Search,
    color: "bg-[#dff4c7] text-[#31520e]",
  },
  {
    title: "Make every answer last",
    description:
      "Keep useful solutions accessible after the Discord timeline has moved on.",
    icon: MessageCircle,
    color: "bg-[#e6e3ff] text-[#5145a7]",
  },
  {
    title: "Bring discovery back home",
    description:
      "Show readers the community behind the answer and send them into the original conversation.",
    icon: Globe2,
    color: "bg-[#ffd9c7] text-[#7b381b]",
  },
] as const

const buttonBase =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-black/20 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"

export function NewLandingPage() {
  return (
    <div className="new-landing-surface">
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
          <Outcomes />
          <Tagline />
          <HowItWorks />
          <ProductStory />
          <AiDiscovery />
          <SourceTrust />
          <FAQ />
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
        <a className="flex items-baseline gap-2" href="/">
          <span className="text-xl tracking-[-0.03em]">Velumn</span>
          <span className="rounded-full border border-[#cbc9bf] px-2 py-0.5 text-xs tracking-[0.14em] text-[#67665f] uppercase">
            Beta
          </span>
        </a>
        <div className="hidden items-center gap-7 text-sm text-[#56554f] md:flex">
          <a className={navLinkClass} href="/oss-program">
            OSS program
          </a>
          <a className={navLinkClass} href="#how-it-works">
            How it works
          </a>
          <a className={navLinkClass} href="/pricing">
            Pricing
          </a>
          <a className={navLinkClass} href="#faq">
            FAQ
          </a>
        </div>
        <a
          className={cn(
            buttonBase,
            "h-8 gap-1.5 rounded-full bg-[#20201e] px-4 text-white shadow-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#393936] active:translate-y-0 active:scale-[0.98] has-[>svg]:px-2.5"
          )}
          href="/dashboard"
        >
          Start free trial
          <ArrowUpRight />
        </a>
      </nav>
    </div>
  )
}

const navLinkClass =
  "rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"

function Hero() {
  return (
    <header className="relative border-b border-[#cbc9bf] px-4 pt-20 pb-10 sm:px-8 sm:pt-24 lg:px-12 lg:pt-28">
      <div className="mx-auto max-w-6xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#bdbbb1] bg-[#fffef9] px-3 py-1.5 text-xs text-[#4d4c47] shadow-[0_2px_8px_rgba(35,35,30,0.05)]">
          <span className="size-1.5 rounded-full bg-[#7f65ff]" />
          For communities with answers worth sharing
        </div>
        <h1 className="mx-auto max-w-[1120px] text-5xl leading-[0.98] tracking-[-0.05em] text-balance sm:text-6xl lg:text-[5.25rem]">
          Help more people find
          <br className="hidden lg:block" /> your Discord community.
        </h1>
        <p className="mx-auto mt-8 max-w-[720px] text-base leading-7 text-pretty text-[#64635d] sm:text-lg sm:leading-8">
          Velumn turns selected Discord threads into public, search-friendly
          pages. Readers find the answer on the web, then continue the
          conversation in your server.
        </p>
        <div className="mt-8 flex justify-center">
          <a
            className={cn(
              buttonBase,
              "h-12 w-full rounded-full bg-[#20201e] px-6 text-base font-semibold text-white shadow-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#393936] active:translate-y-0 active:scale-[0.98] has-[>svg]:px-4 sm:w-auto"
            )}
            href="/dashboard"
          >
            Start free trial
            <ArrowRight />
          </a>
        </div>
        <p className="mt-4 text-xs text-[#77766f]">
          7 days free. No credit card required.
        </p>
      </div>
      <HeroDemo />
      <a
        className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-md text-sm text-[#56554f] underline decoration-[#aaa89e] underline-offset-4 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4 focus-visible:outline-none"
        href="/thread/1436230598959300718/a_demo_thread"
      >
        See a live Velumn page
        <ArrowUpRight className="size-4" />
      </a>
    </header>
  )
}

function HeroDemo() {
  return (
    <figure className="relative mx-auto mt-16 h-[520px] max-w-[980px] sm:mt-24 sm:h-[640px]">
      <div className="absolute inset-x-0 top-0 h-[490px] overflow-hidden rounded-t-xl border-x border-t border-[#c8c5bc] bg-[#ebe9e3] [mask-image:linear-gradient(to_bottom,black_72%,transparent_100%)] px-1.5 pt-1.5 drop-shadow-sm sm:h-[600px] sm:rounded-t-[20px] sm:px-3 sm:pt-3">
        <div className="h-[760px] overflow-hidden rounded-t-lg border-x border-t border-[#cfccc3] bg-[#fffdf8] text-left text-[#202026] sm:rounded-t-xl">
          <div className="flex h-14 items-center justify-between border-b border-[#dedbd2] px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-[#20201e] text-xs font-medium text-white">
                N
              </div>
              <div>
                <p className="text-sm font-medium">Northstar Community</p>
                <p className="hidden text-xs text-[#8b8981] sm:block">
                  community.northstar.dev
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#77756e] sm:text-sm">
              <Search className="size-4" />
              <span className="hidden sm:inline">Search community</span>
            </div>
          </div>
          <div className="p-5 sm:p-8 lg:p-10">
            <p className="mb-3 hidden text-xs text-[#85827a] sm:block">
              Community operations / Permissions
            </p>
            <h3 className="max-w-3xl text-2xl leading-[1.12] font-medium tracking-[-0.035em] text-balance sm:text-4xl">
              How should I structure roles for a growing Discord community?
            </h3>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#eee9ff] px-2.5 py-1 text-xs text-[#6548d8]">
              <MessageCircle className="size-3.5" />
              Published from Discord · #community-help
            </div>
            <div className="mt-7 grid gap-8 md:grid-cols-[minmax(0,1fr)_210px]">
              <div className="min-w-0">
                <ThreadMessage
                  author="Maya"
                  content="We have moderators, contributors, and several project teams now. How do we keep permissions understandable as the server grows?"
                  isOp
                  time="today at 10:42"
                />
                <div className="my-4 flex items-center gap-2 px-3 text-xs text-[#6f6d66]">
                  <MessagesSquare className="size-4" />1 Reply
                </div>
                <ThreadMessage
                  author="Rowan"
                  className="rounded-lg border border-neutral-200 bg-white"
                  content="Start with a small set of permission roles: admin, moderator, member, and bot. Keep channel visibility separate from moderation access, then test each role with a non-admin account before adding exceptions."
                  time="today at 10:51"
                />
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-white">
                      <MessagesSquare className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Continue the discussion
                      </p>
                      <p className="text-xs text-[#85837c]">
                        Open the original thread
                      </p>
                    </div>
                  </div>
                  <div className="flex w-fit items-center gap-1.5 rounded-full bg-[#20201e] px-4 py-2 text-xs text-white">
                    Open in Discord
                    <ArrowRight className="size-3.5" />
                  </div>
                </div>
              </div>
              <aside className="hidden md:block">
                <div className="rounded-xl border border-[#d8d5cc] bg-white p-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#5865f2] text-white">
                    <MessageCircle className="size-5" />
                  </div>
                  <p className="mt-5 font-medium">Northstar Community</p>
                  <p className="mt-2 text-xs leading-5 text-[#77756e]">
                    Practical answers from the people building and moderating
                    communities.
                  </p>
                  <div className="mt-5 flex items-center justify-center rounded-full border border-[#d4d1c8] px-3 py-2 text-xs">
                    Join the community
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="absolute right-3 bottom-3 left-3 flex flex-col gap-4 rounded-xl bg-[#20201e] p-4 text-left text-white shadow-[0_14px_35px_rgba(32,32,30,0.14)] sm:right-8 sm:bottom-5 sm:left-8 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm font-medium sm:text-base">
            One thread. More ways to discover your community.
          </p>
          <p className="mt-1 hidden text-xs text-white/50 sm:block">
            Velumn handles the public page. Your members keep using Discord.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/65">
          {["Search-ready", "Web-accessible", "Discord linked"].map((item) => (
            <span className="flex items-center gap-1.5" key={item}>
              <Check className="size-3.5 text-[#b6ff69]" strokeWidth={3} />
              {item}
            </span>
          ))}
        </div>
      </figcaption>
    </figure>
  )
}

function ThreadMessage({
  author,
  className,
  content,
  isOp = false,
  time,
}: {
  author: string
  className?: string
  content: string
  isOp?: boolean
  time: string
}) {
  return (
    <div className={cn("p-3", className)}>
      <div className="flex gap-2">
        <div className="flex w-9 shrink-0 justify-center">
          <div className="flex size-7 items-center justify-center rounded-full bg-[#202026]">
            <MessageCircle className="size-4 text-white" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1 text-xs">
            <span className="font-medium">{author}</span>
            {isOp && (
              <span className="border border-purple-700 px-1 text-xs text-purple-700">
                OP
              </span>
            )}
            <span className="text-neutral-500">• {time}</span>
          </div>
          <p className="text-xs leading-5 sm:text-sm">{content}</p>
        </div>
      </div>
    </div>
  )
}

function Outcomes() {
  return (
    <section className="border-b border-[#cbc9bf] px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p className="mb-4 text-xs font-medium tracking-[0.18em] text-[#6a52dc] uppercase">
              Discord knowledge
            </p>
            <h2 className="max-w-xl text-4xl leading-[1.06] tracking-[-0.04em] text-balance sm:text-5xl">
              Your community creates value every day. Make it compound.
            </h2>
          </div>
          <p className="max-w-xl leading-7 text-pretty text-[#64635d] lg:justify-self-end lg:text-lg">
            Every solved problem can help the next member, reduce a repeated
            question, and introduce someone new to your community. It just needs
            to survive the timeline.
          </p>
        </div>
        <div className="mt-14 grid overflow-hidden rounded-2xl border border-[#bdbbb1] bg-[#fffef9] md:grid-cols-3">
          {featureCards.map(({ title, description, icon: Icon, color }) => (
            <article
              className="border-b border-[#cbc9bf] p-7 last:border-0 sm:p-9 md:border-r md:border-b-0 md:last:border-r-0"
              key={title}
            >
              <div
                className={cn(
                  "mb-12 flex size-11 items-center justify-center rounded-xl",
                  color
                )}
              >
                <Icon className="size-5" />
              </div>
              <h3 className="text-xl tracking-[-0.025em]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#696861]">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Tagline() {
  return (
    <section className="border-b border-[#cbc9bf] bg-[#e6e3ff] px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
      <p className="mx-auto max-w-[680px] text-center text-4xl tracking-[-0.04em] text-balance text-[#2f2c3d] sm:text-5xl">
        A useful answer should keep working long after the Discord thread goes
        quiet.
      </p>
    </section>
  )
}

function HowItWorks() {
  return (
    <section
      className="scroll-mt-24 border-b border-[#cbc9bf] bg-[#20201e] px-5 py-24 text-[#f9f7ef] sm:px-8 sm:py-32 lg:px-12"
      id="how-it-works"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-medium tracking-[0.18em] text-[#b6ff69] uppercase">
            From thread to web
          </p>
          <h2 className="text-4xl leading-[1.06] tracking-[-0.04em] text-balance sm:text-5xl">
            It starts with a Discord thread.
          </h2>
          <p className="mt-6 max-w-2xl leading-7 text-pretty text-white/60 sm:text-lg">
            No copying answers into a help center. No second community to run.
            Choose the channels that matter and let useful conversations keep
            working after they end.
          </p>
        </div>
        <div className="relative mt-16 grid gap-4 lg:grid-cols-3">
          <div className="absolute top-1/2 right-[15%] left-[15%] hidden h-px bg-white/15 lg:block" />
          <WorkflowCard
            className="bg-[#302e42]"
            icon={MessageCircle}
            step="01"
            title="Your community solves a problem"
          >
            <div className="mt-8 rounded-xl bg-[#242333] p-4">
              <div className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#5865f2]">
                  <MessageCircle
                    className="size-5 text-white"
                    fill="currentColor"
                  />
                </div>
                <div>
                  <p className="text-xs text-[#a8a0ff]">
                    maya · today at 10:42
                  </p>
                  <p className="mt-1 text-sm leading-5 text-white/80">
                    How should I structure permissions for a community server?
                  </p>
                </div>
              </div>
            </div>
          </WorkflowCard>
          <WorkflowCard
            className="bg-[#34382d]"
            icon={Zap}
            step="02"
            title="Velumn gives it a durable page"
          >
            <div className="mt-8 space-y-3 rounded-xl bg-[#262a21] p-4 text-sm">
              {[
                "The complete conversation",
                "Search-friendly structure",
                "A direct path back to Discord",
              ].map((item) => (
                <div className="flex items-center gap-2" key={item}>
                  <Check className="size-4 text-[#b6ff69]" strokeWidth={3} />
                  <span className="text-white/70">{item}</span>
                </div>
              ))}
            </div>
          </WorkflowCard>
          <WorkflowCard
            className="bg-[#3c302a]"
            icon={Search}
            step="03"
            title="The answer keeps working"
          >
            <div className="mt-8 rounded-xl bg-[#2c2420] p-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-xs text-white/50">
                <Search className="size-4" />
                Discord community permissions
              </div>
              <p className="mt-3 text-xs text-[#d1ff9f]">velumn.com › thread</p>
              <p className="mt-1 text-sm text-white/80">
                How to structure permissions for a community server
              </p>
            </div>
          </WorkflowCard>
        </div>
      </div>
    </section>
  )
}

function WorkflowCard({
  children,
  className,
  icon: Icon,
  step,
  title,
}: {
  children: React.ReactNode
  className: string
  icon: LucideIcon
  step: string
  title: string
}) {
  return (
    <article
      className={cn(
        "relative z-10 min-h-[320px] rounded-2xl border border-white/10 p-6 sm:p-7",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-full bg-white/10">
          <Icon className="size-5" />
        </div>
        <span className="font-mono text-xs text-white/35">{step}</span>
      </div>
      <h3 className="mt-8 text-2xl tracking-[-0.03em]">{title}</h3>
      {children}
    </article>
  )
}

function ProductStory() {
  const channels = [
    ["#general", "Not connected", false],
    ["#help-and-support", "Index public threads", true],
    ["#product-feedback", "Index public threads", true],
    ["#team-only", "Not connected", false],
  ] satisfies [string, string, boolean][]

  return (
    <section className="scroll-mt-24 border-b border-[#cbc9bf]" id="features">
      <div className="grid lg:grid-cols-2">
        <div className="relative min-h-[540px] overflow-hidden border-b border-[#cbc9bf] bg-[#ffdaca] p-6 sm:p-10 lg:border-r lg:border-b-0 lg:p-14">
          <div className="mx-auto max-w-md space-y-3">
            {channels.map(([channel, label, enabled]) => (
              <div
                className="flex items-center justify-between rounded-xl border border-[#ca9f8d] bg-[#fffaf3] p-4 shadow-[0_8px_20px_rgba(95,55,35,0.06)] sm:p-5"
                key={channel}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[#9c7665]">#</span>
                  <span className="text-sm sm:text-base">
                    {channel.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs text-[#7d655a] sm:inline">
                    {label}
                  </span>
                  <span
                    className={cn(
                      "flex h-6 w-10 items-center rounded-full p-1",
                      enabled ? "justify-end bg-[#20201e]" : "bg-[#d8c6bd]"
                    )}
                  >
                    <span className="size-4 rounded-full bg-white" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-[540px] flex-col justify-center p-6 sm:p-10 lg:p-14">
          <p className="mb-4 text-xs font-medium tracking-[0.18em] text-[#b4542f] uppercase">
            Publishing controls
          </p>
          <h2 className="max-w-xl text-4xl leading-[1.05] tracking-[-0.045em] text-balance sm:text-5xl">
            Publish the knowledge. Keep control of the source.
          </h2>
          <p className="mt-6 max-w-lg leading-7 text-[#66655f]">
            Choose the channels Velumn indexes instead of mirroring your entire
            server. Public pages stay in sync with message edits and deletions,
            while members can anonymize their displayed names.
          </p>
          <div className="mt-9 grid gap-3 text-sm sm:grid-cols-2">
            {[
              "Channel-level publishing controls",
              "Edits and deletions stay in sync",
            ].map((item) => (
              <div className="flex items-center gap-2" key={item}>
                <Check className="size-4 text-[#7a5ce0]" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function AiDiscovery() {
  return (
    <section className="border-b border-[#cbc9bf]">
      <div className="grid lg:grid-cols-2">
        <div className="flex min-h-[560px] flex-col justify-center border-b border-[#cbc9bf] p-6 sm:p-10 lg:border-r lg:border-b-0 lg:p-14">
          <p className="mb-4 text-xs font-medium tracking-[0.18em] text-[#527d22] uppercase">
            Velumn for AI
          </p>
          <h2 className="max-w-xl text-4xl leading-[1.05] tracking-[-0.045em] text-balance sm:text-5xl">
            Give AI tools a source they can actually access.
          </h2>
          <p className="mt-6 max-w-lg leading-7 text-[#66655f]">
            Answers locked inside Discord are invisible to the open web. Public
            Velumn pages create stable source material that AI tools may
            reference when answering related questions.
          </p>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            {[
              "Web-accessible, structured source pages",
              "Original context and community stay attached",
            ].map((item) => (
              <div className="flex items-center gap-2" key={item}>
                <Check className="size-4 text-[#527d22]" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-[560px] items-center overflow-hidden bg-[#dff4c7] p-6 sm:p-10 lg:p-14">
          <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[#9ebd7c] bg-[#fffef9] shadow-[0_24px_55px_rgba(49,82,14,0.12)]">
            <div className="flex items-center gap-3 border-b border-[#dedbe9] px-5 py-4 sm:px-6">
              <div className="flex size-8 items-center justify-center rounded-full bg-[#20201e] text-white">
                <Bot className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">ChatGPT</p>
                <p className="text-xs text-[#8a8880]">Answer with sources</p>
              </div>
            </div>
            <div className="space-y-6 p-5 sm:p-6">
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[#f0eee7] px-4 py-3 text-sm leading-6">
                How should I structure permissions for a community Discord?
              </div>
              <div>
                <div className="flex gap-3">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#20201e] text-white">
                    <Bot className="size-3.5" />
                  </div>
                  <p className="text-sm leading-6 text-[#45443f]">
                    Start with role-based access, keep administrative
                    permissions separate, and make public support channels
                    readable without exposing private areas.
                  </p>
                </div>
                <div className="mt-5 flex w-fit max-w-full items-center gap-2 text-xs">
                  <span className="shrink-0 text-[#77756e]">Sources:</span>
                  <div className="flex min-w-0 items-center gap-1 rounded-[4px] bg-[#f0eee7] px-1 py-0.5">
                    <div className="flex shrink-0 items-center justify-center rounded-full bg-white p-0.5">
                      <MessagesSquare className="size-3" />
                    </div>
                    <span className="truncate leading-normal">
                      A practical permissions model for Discord
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#deddd6] bg-white p-1.5 pl-3 shadow-[0_4px_16px_rgba(32,32,30,0.07)]">
                <button
                  aria-label="Add attachment"
                  className="flex size-7 shrink-0 items-center justify-center text-[#20201e]"
                  disabled
                  type="button"
                >
                  <Plus className="size-5" />
                </button>
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#77756e] outline-none placeholder:text-[#9a9891]"
                  disabled
                  placeholder="Ask ChatGPT"
                  type="text"
                />
                <div className="hidden items-center gap-1 text-xs text-[#888680] sm:flex">
                  High
                  <ChevronDown className="size-3.5" />
                </div>
                <button
                  aria-label="Use microphone"
                  className="flex size-7 shrink-0 items-center justify-center text-[#20201e]"
                  disabled
                  type="button"
                >
                  <Mic className="size-5" />
                </button>
                <button
                  aria-label="Start voice mode"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
                  disabled
                  type="button"
                >
                  <AudioWaveform className="size-5" strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SourceTrust() {
  return (
    <section className="border-b border-[#cbc9bf] px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-[#aaa89e] bg-[#20201e] text-white lg:grid-cols-[1.2fr_0.8fr]">
        <div className="p-7 sm:p-12 lg:p-16">
          <div className="mb-10 flex size-12 items-center justify-center rounded-xl bg-white/10">
            <Code2 className="size-6" />
          </div>
          <p className="text-xs font-medium tracking-[0.18em] text-[#b6ff69] uppercase">
            Publicly inspectable
          </p>
          <h2 className="mt-4 max-w-xl text-4xl leading-[1.05] tracking-[-0.045em] text-balance sm:text-5xl">
            Trust starts with code you can inspect.
          </h2>
          <p className="mt-6 max-w-lg leading-7 text-white/55">
            Velumn&apos;s source is public. See how your community pages work,
            review every change, and report issues directly on GitHub.
          </p>
          <a
            className={cn(
              buttonBase,
              "mt-9 h-11 rounded-full border border-white/20 bg-white px-6 text-black shadow-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#efede6] active:translate-y-0 active:scale-[0.98] has-[>svg]:px-4"
            )}
            href="https://github.com/lmssiehdev/velumn"
            rel="noopener noreferrer"
            target="_blank"
          >
            Inspect the source
            <ArrowUpRight />
          </a>
        </div>
        <div className="border-t border-white/10 bg-[#292927] lg:border-t-0 lg:border-l">
          <div className="flex h-full min-h-[360px] items-center justify-center p-8">
            <div className="w-full max-w-sm rotate-2 rounded-xl border border-white/15 bg-[#181817] p-5 font-mono text-xs shadow-2xl">
              <div className="mb-5 flex gap-1.5">
                <span className="size-2 rounded-full bg-white/20" />
                <span className="size-2 rounded-full bg-white/20" />
                <span className="size-2 rounded-full bg-white/20" />
              </div>
              <p className="text-white/40">$ git clone velumn</p>
              <p className="mt-3 text-[#b6ff69]">
                Cloning into &apos;velumn&apos;...
              </p>
              <p className="mt-3 text-white/65">
                remote: source available for inspection
              </p>
              <p className="mt-1 text-white/65">
                Receiving objects: 100% complete
              </p>
              <p className="mt-3 text-[#b7adff]">Ready to inspect</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function FAQ() {
  return (
    <section
      className="border-b border-[#cbc9bf] px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
      id="faq"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="mb-4 text-xs font-medium tracking-[0.18em] text-[#6a52dc] uppercase">
            Before you publish
          </p>
          <h2 className="text-4xl leading-[1.04] tracking-[-0.045em] sm:text-5xl">
            Your Discord stays yours.
          </h2>
          <p className="mt-5 max-w-sm leading-7 text-[#696861]">
            Velumn adds a public layer to selected threads without changing
            where your community talks.
          </p>
        </div>
        <div className="border-t border-[#cbc9bf]">
          {faqItems.map((item, index) => (
            <Collapsible.Root key={item.question}>
              <Collapsible.Trigger className="group flex w-full items-center gap-5 border-b border-[#cbc9bf] py-6 text-left sm:py-7">
                <span className="font-mono text-xs text-[#9a9890]">
                  0{index + 1}
                </span>
                <span className="flex-1 text-lg sm:text-xl">
                  {item.question}
                </span>
                <ChevronDown className="size-4 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[panel-open]:rotate-180" />
              </Collapsible.Trigger>
              <Collapsible.Panel className="border-b border-[#cbc9bf] py-6 pr-8 pl-10 leading-7 text-[#66655f] sm:pl-12">
                {item.answer}
              </Collapsible.Panel>
            </Collapsible.Root>
          ))}
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
          <MessageCircle className="size-6 text-[#5865f2]" />
        </div>
        <h2 className="text-4xl leading-[1] tracking-[-0.05em] text-balance sm:text-6xl lg:text-7xl">
          Your community already has answers worth finding.
        </h2>
        <p className="mx-auto mt-7 max-w-xl leading-7 text-pretty text-[#5e5d57] sm:text-lg">
          Turn selected public threads into durable pages that keep helping,
          keep earning trust, and keep leading people back to Discord.
        </p>
        <a
          className={cn(
            buttonBase,
            "mt-9 h-12 rounded-full bg-[#20201e] px-7 text-base font-semibold text-white shadow-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#393936] active:translate-y-0 active:scale-[0.98] has-[>svg]:px-4"
          )}
          href="/dashboard"
        >
          Start free trial
          <ArrowUpRight />
        </a>
        <p className="mt-4 text-xs text-[#68647a]">
          7 days free. No credit card required.
        </p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-[#cbc9bf] bg-[#20201e] text-white/65">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 border-x border-white/10 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-baseline gap-3">
          <span className="text-lg text-white">Velumn</span>
          <span>Help more people find your Discord community.</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <a className={footerLinkClass} href="/pricing">
            Pricing
          </a>
          <a className={footerLinkClass} href="/oss-program">
            OSS program
          </a>
          <a
            className={footerLinkClass}
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

const footerLinkClass =
  "rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e]"
