import ArrowRight02Icon from "@hugeicons/core-free-icons/ArrowRight02Icon";
import ArrowUpRight03Icon from "@hugeicons/core-free-icons/ArrowUpRight03Icon";
import ChatGptIcon from "@hugeicons/core-free-icons/ChatGptIcon";
import ChevronDownIcon from "@hugeicons/core-free-icons/ChevronDownIcon";
import DiscordIcon from "@hugeicons/core-free-icons/DiscordIcon";
import GithubIcon from "@hugeicons/core-free-icons/GithubIcon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	CheckIcon,
	DiscordLogoIcon,
	LightningIcon,
	MagnifyingGlassIcon,
	MicrophoneIcon,
	PlusIcon,
	WaveformIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { TrackLink } from "@/components/analytics/track-link";
import { ChatsCircleIcon } from "@/components/icons/phosphor-chat";
import { FaqJsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";

export const metadata: Metadata = buildPageMetadata({
	title: "Help More People Find Your Discord Community",
	description:
		"Turn selected Discord threads into public, search-friendly pages that help people find your answers and join your community.",
	canonicalUrl: absoluteUrl("/new-landing"),
	robots: { index: false, follow: true },
});

const faqItems = [
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
] as const;

const featureCards = [
	{
		title: "Get found beyond Discord",
		description:
			"Give selected public threads readable pages with search-friendly metadata and stable URLs.",
		icon: Search01Icon,
		color: "bg-[#dff4c7] text-[#31520e]",
	},
	{
		title: "Make every answer last",
		description:
			"Keep useful solutions accessible after the Discord timeline has moved on.",
		icon: DiscordIcon,
		color: "bg-[#e6e3ff] text-[#5145a7]",
	},
	{
		title: "Bring discovery back home",
		description:
			"Show readers the community behind the answer and send them into the original conversation.",
		icon: Globe02Icon,
		color: "bg-[#ffd9c7] text-[#7b381b]",
	},
] as const;

export default function NewLandingPage() {
	return (
		<>
			<a
				className="fixed top-3 left-3 z-50 -translate-y-16 rounded-md bg-[#20201e] px-4 py-2 text-sm text-white transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] focus:translate-y-0"
				href="#main-content"
			>
				Skip to content
			</a>
			<FaqJsonLd items={[...faqItems]} />
			<Navigation />
			<main
				className="min-h-screen overflow-hidden bg-[#f7f5ed] text-[#191918]"
				id="main-content"
			>
				<div className="mx-auto max-w-[1280px] border-[#cbc9bf] border-x">
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
		</>
	);
}

function Navigation() {
	return (
		<div className="border-[#cbc9bf] border-b bg-[#f7f5ed]/90 backdrop-blur-lg">
			<nav
				aria-label="Primary"
				className="mx-auto flex h-16 max-w-[1280px] items-center justify-between border-[#cbc9bf] border-x px-4 sm:px-7"
			>
				<Link className="flex items-baseline gap-2" href="/">
					<span className="text-xl tracking-[-0.03em]">Velumn</span>
					<span className="rounded-full border border-[#cbc9bf] px-2 py-0.5 text-[#67665f] text-xs uppercase tracking-[0.14em]">
						Beta
					</span>
				</Link>
				<div className="hidden items-center gap-7 text-sm text-[#56554f] md:flex">
					<Link
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"
						href="/oss-program"
					>
						OSS program
					</Link>
					<a
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"
						href="#how-it-works"
					>
						How it works
					</a>
					<Link
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"
						href="/pricing"
					>
						Pricing
					</Link>
					<a
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"
						href="#faq"
					>
						FAQ
					</a>
				</div>
				<TrackLink
					className={cn(
						buttonVariants({ size: "sm" }),
						"rounded-full bg-[#20201e] px-4 shadow-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#393936] active:translate-y-0 active:scale-[0.98]",
					)}
					eventData={{ source: "new-landing-nav" }}
					eventKey="addServer"
					href="https://dashboard.velumn.com"
					rel="noopener"
					target="_blank"
				>
					Start free trial
					<HugeiconsIcon icon={ArrowUpRight03Icon} />
				</TrackLink>
			</nav>
		</div>
	);
}

function Hero() {
	return (
		<header className="relative border-[#cbc9bf] border-b px-4 pt-20 pb-10 sm:px-8 sm:pt-28 lg:px-12 lg:pt-36">
			<div className="mx-auto max-w-5xl text-center">
				<div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#bdbbb1] bg-[#fffef9] px-3 py-1.5 text-xs text-[#4d4c47] shadow-[0_2px_8px_rgba(35,35,30,0.05)]">
					<span className="size-1.5 rounded-full bg-[#7f65ff]" />
					For communities with answers worth sharing
				</div>
				<h1 className="mx-auto max-w-[680px] text-balance text-5xl tracking-[-0.04em] sm:text-6xl">
					Help more people find your Discord community.
				</h1>
				<p className="mx-auto mt-7 max-w-[680px] text-pretty text-base text-[#64635d] sm:text-lg">
					Velumn turns selected Discord threads into public, search-friendly
					pages. Readers find the answer on the web, then continue the
					conversation in your server.
				</p>
				<div className="mt-9 flex justify-center">
					<TrackLink
						className={cn(
							buttonVariants({ size: "lg" }),
							"h-12 w-full rounded-full bg-[#20201e] px-6 font-semibold text-base shadow-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#393936] active:translate-y-0 active:scale-[0.98] sm:w-auto",
						)}
						eventData={{ source: "new-landing-hero" }}
						eventKey="addServer"
						href="https://dashboard.velumn.com"
						rel="noopener"
						target="_blank"
					>
						Start free trial
						<HugeiconsIcon icon={ArrowRight02Icon} />
					</TrackLink>
				</div>
				<p className="mt-4 text-xs text-[#77766f]">
					7 days free. No credit card required.
				</p>
			</div>

			<HeroDemo />
			<TrackLink
				className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-md text-sm text-[#56554f] underline decoration-[#aaa89e] underline-offset-4 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"
				eventData={undefined}
				eventKey="clickedDemoLink"
				href="/thread/1436230598959300718/a_demo_thread"
			>
				See a live Velumn page
				<HugeiconsIcon className="size-4" icon={ArrowUpRight03Icon} />
			</TrackLink>
		</header>
	);
}

function HeroDemo() {
	return (
		<figure className="relative mx-auto mt-16 h-[520px] max-w-[980px] sm:mt-24 sm:h-[640px]">
			<div className="absolute inset-x-0 top-0 h-[490px] overflow-hidden rounded-t-xl border-[#c8c5bc] border-x border-t bg-[#ebe9e3] px-1.5 pt-1.5 drop-shadow-sm [mask-image:linear-gradient(to_bottom,black_72%,transparent_100%)] sm:h-[600px] sm:rounded-t-[20px] sm:px-3 sm:pt-3">
				<div className="h-[760px] overflow-hidden rounded-t-lg border-[#cfccc3] border-x border-t bg-[#fffdf8] text-left text-[#202026] sm:rounded-t-xl">
					<div className="flex h-14 items-center justify-between border-[#dedbd2] border-b px-4 sm:px-6">
						<div className="flex items-center gap-2.5">
							<div className="flex size-7 items-center justify-center rounded-lg bg-[#20201e] font-medium text-white text-xs">
								N
							</div>
							<div>
								<p className="font-medium text-sm">Northstar Community</p>
								<p className="hidden text-[#8b8981] text-xs sm:block">
									community.northstar.dev
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 text-[#77756e] text-xs sm:text-sm">
							<HugeiconsIcon className="size-4" icon={Search01Icon} />
							<span className="hidden sm:inline">Search community</span>
						</div>
					</div>

					<div className="p-5 sm:p-8 lg:p-10">
						<p className="mb-3 hidden text-[#85827a] text-xs sm:block">
							Community operations / Permissions
						</p>
						<h3 className="max-w-3xl text-balance font-medium text-2xl leading-[1.12] tracking-[-0.035em] sm:text-4xl">
							How should I structure roles for a growing Discord community?
						</h3>
						<div className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#eee9ff] px-2.5 py-1 text-[#6548d8] text-xs">
							<HugeiconsIcon className="size-3.5" icon={DiscordIcon} />
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
								<div className="my-4 flex items-center gap-2 px-3 text-[#6f6d66] text-xs">
									<ChatsCircleIcon className="size-4" />1 Reply
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
											<ChatsCircleIcon className="size-5" />
										</div>
										<div>
											<p className="font-medium text-sm">
												Continue the discussion
											</p>
											<p className="text-[#85837c] text-xs">
												Open the original thread
											</p>
										</div>
									</div>
									<div className="flex w-fit items-center gap-1.5 rounded-full bg-[#20201e] px-4 py-2 text-white text-xs">
										Open in Discord
										<HugeiconsIcon
											className="size-3.5"
											icon={ArrowRight02Icon}
										/>
									</div>
								</div>
							</div>

							<aside className="hidden md:block">
								<div className="rounded-xl border border-[#d8d5cc] bg-white p-5">
									<div className="flex size-10 items-center justify-center rounded-xl bg-[#5865f2] text-white">
										<HugeiconsIcon className="size-5" icon={DiscordIcon} />
									</div>
									<p className="mt-5 font-medium">Northstar Community</p>
									<p className="mt-2 text-[#77756e] text-xs leading-5">
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
					<p className="font-medium text-sm sm:text-base">
						One thread. More ways to discover your community.
					</p>
					<p className="mt-1 hidden text-white/50 text-xs sm:block">
						Velumn handles the public page. Your members keep using Discord.
					</p>
				</div>
				<div className="flex flex-wrap gap-x-4 gap-y-2 text-white/65 text-xs">
					<span className="flex items-center gap-1.5">
						<CheckIcon className="size-3.5 text-[#b6ff69]" weight="bold" />
						Search-ready
					</span>
					<span className="flex items-center gap-1.5">
						<CheckIcon className="size-3.5 text-[#b6ff69]" weight="bold" />
						Web-accessible
					</span>
					<span className="flex items-center gap-1.5">
						<CheckIcon className="size-3.5 text-[#b6ff69]" weight="bold" />
						Discord linked
					</span>
				</div>
			</figcaption>
		</figure>
	);
}

function ThreadMessage({
	author,
	className,
	content,
	isOp = false,
	time,
}: {
	author: string;
	className?: string;
	content: string;
	isOp?: boolean;
	time: string;
}) {
	return (
		<div className={cn("p-3", className)}>
			<div className="flex gap-2">
				<div className="flex w-9 shrink-0 justify-center">
					<div className="flex size-7 items-center justify-center rounded-full bg-[#202026]">
						<HugeiconsIcon className="size-4 text-white" icon={DiscordIcon} />
					</div>
				</div>
				<div className="min-w-0 flex-1">
					<div className="mb-1 flex flex-wrap items-center gap-1 text-xs">
						<span className="font-medium">{author}</span>
						{isOp && (
							<span className="border border-purple-700 px-1 text-purple-700 text-xs">
								OP
							</span>
						)}
						<span className="text-neutral-500">• {time}</span>
					</div>
					<p className="text-xs leading-5 sm:text-sm">{content}</p>
				</div>
			</div>
		</div>
	);
}

function Outcomes() {
	return (
		<section className="border-[#cbc9bf] border-b px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
			<div className="mx-auto max-w-6xl">
				<div className="grid gap-8 lg:grid-cols-2 lg:items-end">
					<div>
						<p className="mb-4 font-medium text-[#6a52dc] text-xs uppercase tracking-[0.18em]">
							Discord knowledge
						</p>
						<h2 className="max-w-xl text-balance text-4xl leading-[1.06] tracking-[-0.04em] sm:text-5xl">
							Your community creates value every day. Make it compound.
						</h2>
					</div>
					<p className="max-w-xl text-pretty text-[#64635d] leading-7 lg:justify-self-end lg:text-lg">
						Every solved problem can help the next member, reduce a repeated
						question, and introduce someone new to your community. It just needs
						to survive the timeline.
					</p>
				</div>
				<div className="mt-14 grid overflow-hidden rounded-2xl border border-[#bdbbb1] bg-[#fffef9] md:grid-cols-3">
					{featureCards.map(({ title, description, icon: Icon, color }) => (
						<article
							className="border-[#cbc9bf] border-b p-7 last:border-0 md:border-r md:border-b-0 md:last:border-r-0 sm:p-9"
							key={title}
						>
							<div
								className={cn(
									"mb-12 flex size-11 items-center justify-center rounded-xl",
									color,
								)}
							>
								<HugeiconsIcon className="size-5" icon={Icon} />
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
	);
}

function Tagline() {
	return (
		<section className="border-[#cbc9bf] border-b bg-[#e6e3ff] px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
			<p className="mx-auto max-w-[680px] text-balance text-center text-4xl tracking-[-0.04em] text-[#2f2c3d] sm:text-5xl">
				A useful answer should keep working long after the Discord thread goes
				quiet.
			</p>
		</section>
	);
}

function HowItWorks() {
	return (
		<section
			className="scroll-mt-24 border-[#cbc9bf] border-b bg-[#20201e] px-5 py-24 text-[#f9f7ef] sm:px-8 sm:py-32 lg:px-12"
			id="how-it-works"
		>
			<div className="mx-auto max-w-6xl">
				<div className="max-w-3xl">
					<p className="mb-4 font-medium text-[#b6ff69] text-xs uppercase tracking-[0.18em]">
						From thread to web
					</p>
					<h2 className="text-balance text-4xl leading-[1.06] tracking-[-0.04em] sm:text-5xl">
						It starts with a Discord thread.
					</h2>
					<p className="mt-6 max-w-2xl text-pretty leading-7 text-white/60 sm:text-lg">
						No copying answers into a help center. No second community to run.
						Choose the channels that matter and let useful conversations keep
						working after they end.
					</p>
				</div>

				<div className="relative mt-16 grid gap-4 lg:grid-cols-3">
					<div className="absolute top-1/2 right-[15%] left-[15%] hidden h-px bg-white/15 lg:block" />
					<WorkflowCard
						className="bg-[#302e42]"
						icon={DiscordLogoIcon}
						step="01"
						title="Your community solves a problem"
					>
						<div className="mt-8 rounded-xl bg-[#242333] p-4">
							<div className="flex gap-3">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#5865f2]">
									<DiscordLogoIcon
										className="size-5 text-white"
										weight="fill"
									/>
								</div>
								<div>
									<p className="text-[#a8a0ff] text-xs">
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
						icon={LightningIcon}
						step="02"
						title="Velumn gives it a durable page"
					>
						<div className="mt-8 space-y-3 rounded-xl bg-[#262a21] p-4 text-sm">
							<div className="flex items-center gap-2">
								<CheckIcon className="size-4 text-[#b6ff69]" weight="bold" />
								<span className="text-white/70">The complete conversation</span>
							</div>
							<div className="flex items-center gap-2">
								<CheckIcon className="size-4 text-[#b6ff69]" weight="bold" />
								<span className="text-white/70">Search-friendly structure</span>
							</div>
							<div className="flex items-center gap-2">
								<CheckIcon className="size-4 text-[#b6ff69]" weight="bold" />
								<span className="text-white/70">
									A direct path back to Discord
								</span>
							</div>
						</div>
					</WorkflowCard>

					<WorkflowCard
						className="bg-[#3c302a]"
						icon={MagnifyingGlassIcon}
						step="03"
						title="The answer keeps working"
					>
						<div className="mt-8 rounded-xl bg-[#2c2420] p-4">
							<div className="flex items-center gap-2 border-white/10 border-b pb-3 text-xs text-white/50">
								<MagnifyingGlassIcon className="size-4" />
								Discord community permissions
							</div>
							<p className="mt-3 text-[#d1ff9f] text-xs">velumn.com › thread</p>
							<p className="mt-1 text-sm text-white/80">
								How to structure permissions for a community server
							</p>
						</div>
					</WorkflowCard>
				</div>
			</div>
		</section>
	);
}

function WorkflowCard({
	children,
	className,
	icon: Icon,
	step,
	title,
}: {
	children: React.ReactNode;
	className: string;
	icon: typeof DiscordLogoIcon;
	step: string;
	title: string;
}) {
	return (
		<article
			className={cn(
				"relative z-10 min-h-[320px] rounded-2xl border border-white/10 p-6 sm:p-7",
				className,
			)}
		>
			<div className="flex items-center justify-between">
				<div className="flex size-10 items-center justify-center rounded-full bg-white/10">
					<Icon className="size-5" weight="duotone" />
				</div>
				<span className="font-mono text-white/35 text-xs">{step}</span>
			</div>
			<h3 className="mt-8 text-2xl tracking-[-0.03em]">{title}</h3>
			{children}
		</article>
	);
}

function AiDiscovery() {
	return (
		<section className="border-[#cbc9bf] border-b">
			<div className="grid lg:grid-cols-2">
				<div className="flex min-h-[560px] flex-col justify-center border-[#cbc9bf] border-b p-6 sm:p-10 lg:border-r lg:border-b-0 lg:p-14">
					<p className="mb-4 font-medium text-[#527d22] text-xs uppercase tracking-[0.18em]">
						Velumn for AI
					</p>
					<h2 className="max-w-xl text-balance text-4xl leading-[1.05] tracking-[-0.045em] sm:text-5xl">
						Give AI tools a source they can actually access.
					</h2>
					<p className="mt-6 max-w-lg leading-7 text-[#66655f]">
						Answers locked inside Discord are invisible to the open web. Public
						Velumn pages create stable source material that AI tools may
						reference when answering related questions.
					</p>
					<div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm">
						<div className="flex items-center gap-2">
							<HugeiconsIcon
								className="size-4 text-[#527d22]"
								icon={Tick02Icon}
							/>
							Web-accessible, structured source pages
						</div>
						<div className="flex items-center gap-2">
							<HugeiconsIcon
								className="size-4 text-[#527d22]"
								icon={Tick02Icon}
							/>
							Original context and community stay attached
						</div>
					</div>
				</div>

				<div className="flex min-h-[560px] items-center overflow-hidden bg-[#dff4c7] p-6 sm:p-10 lg:p-14">
					<div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[#9ebd7c] bg-[#fffef9] shadow-[0_24px_55px_rgba(49,82,14,0.12)]">
						<div className="flex items-center gap-3 border-[#dedbe9] border-b px-5 py-4 sm:px-6">
							<div className="flex size-8 items-center justify-center rounded-full bg-[#20201e] text-white">
								<HugeiconsIcon className="size-4" icon={ChatGptIcon} />
							</div>
							<div>
								<p className="font-medium text-sm">ChatGPT</p>
								<p className="text-[#8a8880] text-xs">Answer with sources</p>
							</div>
						</div>

						<div className="space-y-6 p-5 sm:p-6">
							<div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[#f0eee7] px-4 py-3 text-sm leading-6">
								How should I structure permissions for a community Discord?
							</div>

							<div>
								<div className="flex gap-3">
									<div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#20201e] text-white">
										<HugeiconsIcon className="size-3.5" icon={ChatGptIcon} />
									</div>
									<p className="text-[#45443f] text-sm leading-6">
										Start with role-based access, keep administrative
										permissions separate, and make public support channels
										readable without exposing private areas.
									</p>
								</div>

								<div className="mt-5 flex w-fit max-w-full items-center gap-2 text-xs">
									<span className="shrink-0 text-[#77756e]">Sources:</span>
									<div className="flex min-w-0 items-center gap-1 rounded-[4px] bg-[#f0eee7] px-1 py-0.5">
										<div className="flex shrink-0 items-center justify-center rounded-full bg-white p-0.5">
											<ChatsCircleIcon className="size-3" />
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
									<PlusIcon className="size-5" />
								</button>
								<input
									className="min-w-0 flex-1 bg-transparent text-[#77756e] text-sm outline-none placeholder:text-[#9a9891]"
									disabled
									placeholder="Ask ChatGPT"
									type="text"
								/>
								<div className="hidden items-center gap-1 text-[#888680] text-xs sm:flex">
									High
									<HugeiconsIcon className="size-3.5" icon={ChevronDownIcon} />
								</div>
								<button
									aria-label="Use microphone"
									className="flex size-7 shrink-0 items-center justify-center text-[#20201e]"
									disabled
									type="button"
								>
									<MicrophoneIcon className="size-5" />
								</button>
								<button
									aria-label="Start voice mode"
									className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black text-white"
									disabled
									type="button"
								>
									<WaveformIcon className="size-5" weight="bold" />
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function ProductStory() {
	return (
		<section className="scroll-mt-24 border-[#cbc9bf] border-b" id="features">
			<div className="grid lg:grid-cols-2">
				<div className="relative min-h-[540px] overflow-hidden border-[#cbc9bf] border-b bg-[#ffdaca] p-6 sm:p-10 lg:border-r lg:border-b-0 lg:p-14">
					<div className="mx-auto max-w-md space-y-3">
						{(
							[
								["#general", "Not connected", false],
								["#help-and-support", "Index public threads", true],
								["#product-feedback", "Index public threads", true],
								["#team-only", "Not connected", false],
							] satisfies [string, string, boolean][]
						).map(([channel, label, enabled]) => (
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
									<span className="hidden text-[#7d655a] text-xs sm:inline">
										{label}
									</span>
									<span
										className={cn(
											"flex h-6 w-10 items-center rounded-full p-1",
											enabled ? "justify-end bg-[#20201e]" : "bg-[#d8c6bd]",
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
					<p className="mb-4 font-medium text-[#b4542f] text-xs uppercase tracking-[0.18em]">
						Publishing controls
					</p>
					<h2 className="max-w-xl text-balance text-4xl leading-[1.05] tracking-[-0.045em] sm:text-5xl">
						Publish the knowledge. Keep control of the source.
					</h2>
					<p className="mt-6 max-w-lg leading-7 text-[#66655f]">
						Choose the channels Velumn indexes instead of mirroring your entire
						server. Public pages stay in sync with message edits and deletions,
						while members can anonymize their displayed names.
					</p>
					<div className="mt-9 grid gap-3 text-sm sm:grid-cols-2">
						<div className="flex items-center gap-2">
							<HugeiconsIcon
								className="size-4 text-[#7a5ce0]"
								icon={Tick02Icon}
							/>
							Channel-level publishing controls
						</div>
						<div className="flex items-center gap-2">
							<HugeiconsIcon
								className="size-4 text-[#7a5ce0]"
								icon={Tick02Icon}
							/>
							Edits and deletions stay in sync
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function SourceTrust() {
	return (
		<section className="border-[#cbc9bf] border-b px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
			<div className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-[#aaa89e] bg-[#20201e] text-white lg:grid-cols-[1.2fr_0.8fr]">
				<div className="p-7 sm:p-12 lg:p-16">
					<div className="mb-10 flex size-12 items-center justify-center rounded-xl bg-white/10">
						<HugeiconsIcon className="size-6" icon={GithubIcon} />
					</div>
					<p className="font-medium text-[#b6ff69] text-xs uppercase tracking-[0.18em]">
						Publicly inspectable
					</p>
					<h2 className="mt-4 max-w-xl text-balance text-4xl leading-[1.05] tracking-[-0.045em] sm:text-5xl">
						Trust starts with code you can inspect.
					</h2>
					<p className="mt-6 max-w-lg leading-7 text-white/55">
						Velumn&apos;s source is public. See how your community pages work,
						review every change, and report issues directly on GitHub.
					</p>
					<a
						className={cn(
							buttonVariants({ size: "lg", variant: "outline" }),
							"mt-9 h-11 rounded-full border-white/20 bg-white text-black shadow-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#efede6] active:translate-y-0 active:scale-[0.98]",
						)}
						href="https://github.com/lmssiehdev/velumn"
						rel="noopener noreferrer"
						target="_blank"
					>
						Inspect the source
						<HugeiconsIcon icon={ArrowUpRight03Icon} />
					</a>
				</div>
				<div className="border-white/10 border-t bg-[#292927] lg:border-t-0 lg:border-l">
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
	);
}

export function FAQ() {
	return (
		<section
			className="border-[#cbc9bf] border-b px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
			id="faq"
		>
			<div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.75fr_1.25fr]">
				<div>
					<p className="mb-4 font-medium text-[#6a52dc] text-xs uppercase tracking-[0.18em]">
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
				<div className="border-[#cbc9bf] border-t">
					{faqItems.map((item, index) => (
						<Collapsible key={item.question}>
							<CollapsibleTrigger className="group flex w-full items-center gap-5 border-[#cbc9bf] border-b py-6 text-left sm:py-7">
								<span className="font-mono text-[#9a9890] text-xs">
									0{index + 1}
								</span>
								<span className="flex-1 text-lg sm:text-xl">
									{item.question}
								</span>
								<HugeiconsIcon
									className="size-4 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[state=open]:rotate-180"
									icon={ChevronDownIcon}
								/>
							</CollapsibleTrigger>
							<CollapsibleContent className="border-[#cbc9bf] border-b py-6 pr-8 pl-10 text-[#66655f] leading-7 sm:pl-12">
								{item.answer}
							</CollapsibleContent>
						</Collapsible>
					))}
				</div>
			</div>
		</section>
	);
}

function FinalCTA() {
	return (
		<section className="px-5 py-28 text-center sm:px-8 sm:py-40">
			<div className="mx-auto max-w-4xl">
				<div className="mx-auto mb-7 flex size-12 items-center justify-center rounded-2xl border border-[#b8b5aa] bg-[#fffef9] shadow-sm">
					<HugeiconsIcon className="size-6 text-[#5865f2]" icon={DiscordIcon} />
				</div>
				<h2 className="text-balance text-4xl leading-[1] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
					Your community already has answers worth finding.
				</h2>
				<p className="mx-auto mt-7 max-w-xl text-pretty leading-7 text-[#5e5d57] sm:text-lg">
					Turn selected public threads into durable pages that keep helping,
					keep earning trust, and keep leading people back to Discord.
				</p>
				<TrackLink
					className={cn(
						buttonVariants({ size: "lg" }),
						"mt-9 h-12 rounded-full bg-[#20201e] px-7 font-semibold text-base shadow-none transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#393936] active:translate-y-0 active:scale-[0.98]",
					)}
					eventData={{ source: "new-landing-cta" }}
					eventKey="addServer"
					href="https://dashboard.velumn.com"
					rel="noopener"
					target="_blank"
				>
					Start free trial
					<HugeiconsIcon icon={ArrowUpRight03Icon} />
				</TrackLink>
				<p className="mt-4 text-xs text-[#68647a]">
					7 days free. No credit card required.
				</p>
			</div>
		</section>
	);
}

function Footer() {
	return (
		<footer className="border-[#cbc9bf] border-t bg-[#20201e] text-white/65">
			<div className="mx-auto flex max-w-[1280px] flex-col gap-6 border-white/10 border-x px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
				<div className="flex items-baseline gap-3">
					<span className="text-lg text-white">Velumn</span>
					<span>Help more people find your Discord community.</span>
				</div>
				<div className="flex flex-wrap gap-x-6 gap-y-3">
					<Link
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e]"
						href="/pricing"
					>
						Pricing
					</Link>
					<Link
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e]"
						href="/oss-program"
					>
						OSS program
					</Link>
					<a
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e]"
						href="https://github.com/lmssiehdev/velumn"
						rel="noopener noreferrer"
						target="_blank"
					>
						GitHub ↗
					</a>
				</div>
			</div>
		</footer>
	);
}
