import ArrowRight02Icon from "@hugeicons/core-free-icons/ArrowRight02Icon";
import ArrowUpRight03Icon from "@hugeicons/core-free-icons/ArrowUpRight03Icon";
import GithubIcon from "@hugeicons/core-free-icons/GithubIcon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import Link from "next/link";
import { TrackLink } from "@/components/analytics/track-link";
import { buttonVariants } from "@/components/ui/button";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";

export const metadata: Metadata = buildPageMetadata({
	title: "Simple Pricing for Searchable Discord Answers",
	description:
		"Start publishing Discord threads for free. Upgrade to use your own domain and get priority support for $89 per month.",
	canonicalUrl: absoluteUrl("/pricing"),
});

const freeFeatures = [
	"Hosted on velumn.com",
	"Unlimited indexed channels",
	"Unlimited page views",
	"Public, searchable thread pages",
	"Community support",
] as const;

const proFeatures = [
	"Everything in Free",
	"Your own custom domain",
	"Priority support",
] as const;

export default function PricingPage() {
	return (
		<>
			<a
				className="fixed top-3 left-3 z-50 -translate-y-16 rounded-md bg-[#20201e] px-4 py-2 text-sm text-white transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none focus:translate-y-0"
				href="#main-content"
			>
				Skip to content
			</a>
			<Navigation />
			<main
				className="min-h-screen overflow-hidden bg-[#f7f5ed] text-[#191918]"
				id="main-content"
			>
				<div className="mx-auto max-w-[1280px] border-[#cbc9bf] border-x">
					<Pricing />
					<TestimonialPreview />
					<OssProgram />
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
				<div className="hidden items-center gap-7 text-sm text-[#56554f] sm:flex">
					<Link className={navLinkClassName} href="/">
						Product
					</Link>
					<Link className={navLinkClassName} href="/oss-program">
						OSS program
					</Link>
				</div>
				<DashboardLink eventKey="pricingNav" size="sm">
					Start free
					<HugeiconsIcon icon={ArrowUpRight03Icon} />
				</DashboardLink>
			</nav>
		</div>
	);
}

function Pricing() {
	return (
		<section className="border-[#cbc9bf] border-b px-5 pt-20 pb-24 sm:px-8 sm:pt-28 sm:pb-32 lg:px-12">
			<div className="mx-auto max-w-6xl">
				<header className="mx-auto max-w-6xl text-center">
					<p className="font-medium text-[#6a52dc] text-xs uppercase tracking-[0.18em]">
						Pricing
					</p>
					<h1 className="mx-auto mt-5 max-w-[1120px] text-balance text-5xl leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-[5.25rem]">
						Turn Discord answers
						<br className="hidden lg:block" /> into public knowledge.
					</h1>
					<p className="mx-auto mt-7 max-w-[760px] text-pretty text-base leading-7 text-[#64635d] sm:text-lg sm:leading-8">
						Every plan includes the full publishing setup: unlimited indexed
						channels and page views, automatic syncing, and every answer linked
						back to Discord. Start free on Velumn, or upgrade for your own
						domain and priority support.
					</p>
					<ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[#64635d] text-sm">
						<li className="flex items-center gap-2">
							<HugeiconsIcon
								className="size-4 text-[#527d22]"
								icon={Tick02Icon}
							/>
							7-day Pro trial
						</li>
						<li className="flex items-center gap-2">
							<HugeiconsIcon
								className="size-4 text-[#527d22]"
								icon={Tick02Icon}
							/>
							No credit card
						</li>
						<li className="flex items-center gap-2">
							<HugeiconsIcon
								className="size-4 text-[#527d22]"
								icon={Tick02Icon}
							/>
							Free plan available
						</li>
					</ul>
				</header>

				<div className="mx-auto mt-16 grid max-w-4xl overflow-hidden rounded-2xl border border-[#aaa89e] bg-[#aaa89e] gap-px md:grid-cols-2">
					<PlanCard
						description="For communities that want their answers on the web."
						features={freeFeatures}
						name="Free"
						price="Free"
					>
						<DashboardLink
							eventKey="pricingGetStarted"
							fullWidth
							size="lg"
							variant="outline"
						>
							Start free
							<HugeiconsIcon icon={ArrowRight02Icon} />
						</DashboardLink>
					</PlanCard>
					<PlanCard
						description="For established communities that want publishing under their own brand."
						features={proFeatures}
						featured
						name="Pro"
						price="$89"
					>
						<DashboardLink eventKey="pricingStartTrial" fullWidth size="lg">
							Start 7-day trial
							<HugeiconsIcon icon={ArrowRight02Icon} />
						</DashboardLink>
					</PlanCard>
				</div>
			</div>
		</section>
	);
}

function PlanCard({
	children,
	description,
	featured = false,
	features,
	name,
	price,
}: {
	children: React.ReactNode;
	description: string;
	featured?: boolean;
	features: readonly string[];
	name: string;
	price: string;
}) {
	return (
		<article
			className={cn(
				"flex flex-col p-7 sm:p-9",
				featured ? "bg-[#e6e3ff]" : "bg-[#fffef9]",
			)}
		>
			<div className="flex items-center justify-between gap-4">
				<h2 className="text-xl tracking-[-0.025em]">{name}</h2>
				{featured && (
					<span className="rounded-full bg-[#20201e] px-3 py-1 text-white text-xs">
						Full plan
					</span>
				)}
			</div>
			<div className="mt-8 flex items-end gap-2">
				<p className="tabular-nums text-5xl leading-none tracking-[-0.05em]">
					{price}
				</p>
				{price !== "Free" && (
					<span className="pb-1 text-[#68675f] text-sm">/ month</span>
				)}
			</div>
			<p className="mt-5 min-h-14 text-pretty text-sm leading-6 text-[#64635d]">
				{description}
			</p>
			<div className="mt-7">{children}</div>
			<div className="mt-9 border-[#c6c3b9] border-t pt-8">
				<p className="font-medium text-sm">What&apos;s included</p>
				<ul className="mt-5 space-y-4 text-sm">
					{features.map((feature) => (
						<li className="flex items-start gap-3" key={feature}>
							<HugeiconsIcon
								className="mt-0.5 size-4 shrink-0 text-[#527d22]"
								icon={Tick02Icon}
							/>
							<span>{feature}</span>
						</li>
					))}
				</ul>
			</div>
		</article>
	);
}

// Placeholder content for layout testing. Replace with a verified customer quote before production.
function TestimonialPreview() {
	return (
		<section className="border-[#cbc9bf] border-b bg-[#ffdaca] px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
			<div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.4fr_1.6fr]">
				<p className="font-medium text-[#9a4525] text-xs uppercase tracking-[0.18em]">
					Customer story
				</p>
				<blockquote>
					<p className="text-balance text-3xl leading-[1.12] tracking-[-0.035em] text-[#38241d] sm:text-4xl">
						“We had years of community knowledge buried in Discord. Now our
						users can finally find it.”
					</p>
					<footer className="mt-8 flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-full bg-[#20201e] text-sm text-white">
							T
						</div>
						<div className="text-sm">
							<cite className="not-italic text-[#38241d]">Tyler</cite>
							<p className="mt-0.5 text-[#825c4d]">
								Customer Success at CrownCards
							</p>
						</div>
					</footer>
				</blockquote>
			</div>
		</section>
	);
}

function OssProgram() {
	return (
		<section className="border-[#cbc9bf] border-b px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
			<div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[#aaa89e] bg-[#20201e] p-7 text-white sm:p-12 lg:p-16">
				<div className="flex items-center justify-between gap-6">
					<div className="flex size-12 items-center justify-center rounded-xl bg-white/10">
						<HugeiconsIcon className="size-6" icon={GithubIcon} />
					</div>
					<span className="font-mono text-white/35 text-xs uppercase tracking-[0.14em]">
						Full Pro · $0
					</span>
				</div>
				<p className="mt-12 font-medium text-[#b6ff69] text-xs uppercase tracking-[0.18em]">
					Open-source program
				</p>
				<h2 className="mt-4 max-w-4xl text-balance text-4xl leading-[1.04] tracking-[-0.045em] sm:text-6xl">
					Velumn for open-source communities.
				</h2>
				<Link
					className="mt-9 inline-flex h-11 w-fit items-center justify-center gap-2 rounded-full bg-white px-5 font-medium text-[#20201e] text-sm transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#efede6] active:translate-y-0 active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e]"
					href="/oss-program"
				>
					Explore the OSS program
					<HugeiconsIcon icon={ArrowRight02Icon} />
				</Link>
			</div>
		</section>
	);
}

function DashboardLink({
	children,
	eventKey,
	fullWidth = false,
	size,
	variant = "default",
}: {
	children: React.ReactNode;
	eventKey: string;
	fullWidth?: boolean;
	size: "sm" | "lg";
	variant?: "default" | "outline";
}) {
	return (
		<TrackLink
			className={cn(
				buttonVariants({ size, variant }),
				"rounded-full font-semibold shadow-none transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none",
				variant === "default" && "bg-[#20201e] hover:bg-[#393936]",
				variant === "outline" &&
					"border-[#aaa89e] bg-white text-[#20201e] hover:bg-[#f1efe8] hover:text-[#20201e]",
				size === "lg" && "h-12 px-6 text-base",
				size === "lg" && (fullWidth ? "w-full" : "w-full sm:w-auto"),
			)}
			eventData={{ source: eventKey }}
			eventKey={eventKey}
			href="https://dashboard.velumn.com"
			rel="noopener"
			target="_blank"
		>
			{children}
		</TrackLink>
	);
}

const navLinkClassName =
	"rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4";

function Footer() {
	return (
		<footer className="border-[#cbc9bf] border-t bg-[#20201e] text-white/65">
			<div className="mx-auto flex max-w-[1280px] flex-col gap-6 border-white/10 border-x px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
				<div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
					<span className="text-lg text-white">Velumn</span>
					<span>Help more people find your Discord community.</span>
				</div>
				<div className="flex flex-wrap gap-x-6 gap-y-3">
					<Link className={footerLinkClassName} href="/">
						Product
					</Link>
					<Link className={footerLinkClassName} href="/oss-program">
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
	);
}

const footerLinkClassName =
	"rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e]";
