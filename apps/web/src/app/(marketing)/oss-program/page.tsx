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
	title: "Velumn for Open-Source Communities",
	description:
		"Turn useful open-source Discord threads into public, searchable pages. Accepted projects get Velumn's full paid plan free.",
	canonicalUrl: absoluteUrl("/oss-program"),
});

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
] as const;

export default function OssProgramPage() {
	return (
		<>
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
				<div className="mx-auto max-w-[1280px] border-[#cbc9bf] border-x">
					<Hero />
					<ProgramOffer />
					<Eligibility />
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
					<a
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"
						href="#program"
					>
						What&apos;s included
					</a>
					<a
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"
						href="#eligibility"
					>
						Eligibility
					</a>
					<Link
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"
						href="/"
					>
						Product
					</Link>
				</div>
				<DiscordLink source="oss-program-nav" size="sm">
					Apply in Discord
					<HugeiconsIcon icon={ArrowUpRight03Icon} />
				</DiscordLink>
			</nav>
		</div>
	);
}

function Hero() {
	return (
		<header className="relative border-[#cbc9bf] border-b px-5 pt-20 pb-20 sm:px-8 sm:pt-24 sm:pb-24 lg:px-12 lg:pt-28 lg:pb-32">
			<div className="mx-auto max-w-6xl text-center">
				<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#bdbbb1] bg-[#fffef9] px-3 py-1.5 text-xs text-[#4d4c47] shadow-[0_2px_8px_rgba(35,35,30,0.05)]">
					<HugeiconsIcon
						className="size-3.5 text-[#6a52dc]"
						icon={GithubIcon}
					/>
					Velumn for open-source communities
				</div>
				<h1 className="mx-auto max-w-[1120px] text-balance text-5xl leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-[5.25rem]">
					Make your Discord knowledge
					<br className="hidden lg:block" /> as open as your code.
				</h1>
				<p className="mx-auto mt-8 max-w-[720px] text-pretty text-base leading-7 text-[#64635d] sm:text-lg sm:leading-8">
					Independent, non-commercial open-source projects get Velumn&apos;s
					full paid plan free. Turn useful Discord threads into public,
					searchable pages that lead developers back to your community.
				</p>
				<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<DiscordLink source="oss-program-hero" size="lg">
						Apply in Discord
						<HugeiconsIcon icon={ArrowRight02Icon} />
					</DiscordLink>
					<a
						className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm text-[#56554f] underline decoration-[#aaa89e] underline-offset-4 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6a52dc] focus-visible:ring-offset-4"
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
	);
}

function ProgramOffer() {
	return (
		<section
			className="scroll-mt-24 border-[#cbc9bf] border-b bg-[#20201e] px-5 py-24 text-white sm:px-8 sm:py-32 lg:px-12"
			id="program"
		>
			<div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
				<div>
					<p className="font-medium text-[#b6ff69] text-xs uppercase tracking-[0.18em]">
						From conversation to public knowledge
					</p>
					<h2 className="mt-4 max-w-2xl text-balance text-4xl leading-[1.05] tracking-[-0.045em] sm:text-5xl">
						Answer in Discord. Help developers everywhere.
					</h2>
					<p className="mt-6 max-w-xl text-pretty leading-7 text-white/60 sm:text-lg">
						Velumn publishes selected support threads as lasting web pages and
						keeps every answer connected to its original community. Accepted
						projects receive the complete paid plan free.
					</p>
				</div>
				<div className="rounded-2xl border border-white/15 bg-[#2b2b28] p-7 sm:p-9">
					<div className="flex items-end justify-between gap-6 border-white/10 border-b pb-7">
						<div>
							<p className="text-white/50 text-sm">Complete Velumn plan</p>
							<p className="mt-2 text-4xl tracking-[-0.04em]">$0</p>
						</div>
						<span className="pb-1 text-white/45 text-sm">
							for qualifying projects
						</span>
					</div>
					<ul className="mt-7 space-y-4 text-sm text-white/75">
						<li className="flex items-center gap-3">
							<HugeiconsIcon
								className="size-4 text-[#b6ff69]"
								icon={Tick02Icon}
							/>
							Custom domain
						</li>
						<li className="flex items-center gap-3">
							<HugeiconsIcon
								className="size-4 text-[#b6ff69]"
								icon={Tick02Icon}
							/>
							Unlimited indexed channels
						</li>
						<li className="flex items-center gap-3">
							<HugeiconsIcon
								className="size-4 text-[#b6ff69]"
								icon={Tick02Icon}
							/>
							Unlimited page views
						</li>
						<li className="flex items-center gap-3">
							<HugeiconsIcon
								className="size-4 text-[#b6ff69]"
								icon={Tick02Icon}
							/>
							Priority support
						</li>
					</ul>
				</div>
			</div>
		</section>
	);
}

function Eligibility() {
	return (
		<section
			className="scroll-mt-24 border-[#cbc9bf] border-b px-5 py-24 sm:px-8 sm:py-32 lg:px-12"
			id="eligibility"
		>
			<div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
				<div>
					<p className="mb-4 font-medium text-[#b4542f] text-xs uppercase tracking-[0.18em]">
						Eligibility
					</p>
					<h2 className="text-balance text-4xl leading-[1.05] tracking-[-0.045em] sm:text-5xl">
						Who&apos;s eligible?
					</h2>
					<p className="mt-6 max-w-md leading-7 text-[#66655f]">
						We review each project to keep the program focused on active,
						genuinely open-source communities.
					</p>
				</div>
				<div>
					<ol className="border-[#cbc9bf] border-t">
						{eligibility.map((item, index) => (
							<li
								className="grid grid-cols-[2.5rem_1fr] gap-3 border-[#cbc9bf] border-b py-7 sm:grid-cols-[3.5rem_1fr] sm:py-8"
								key={item.title}
							>
								<span className="font-mono text-[#9a9890] text-xs">
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
	);
}

function FinalCTA() {
	return (
		<section className="px-5 py-28 text-center sm:px-8 sm:py-40">
			<div className="mx-auto max-w-4xl">
				<div className="mx-auto mb-7 flex size-12 items-center justify-center rounded-2xl border border-[#b8b5aa] bg-[#fffef9] shadow-sm">
					<HugeiconsIcon className="size-6 text-[#6a52dc]" icon={GithubIcon} />
				</div>
				<h2 className="text-balance text-4xl leading-[1] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
					Open up the answers your project already has.
				</h2>
				<p className="mx-auto mt-7 max-w-xl text-pretty leading-7 text-[#5e5d57] sm:text-lg">
					Join our Discord, share your repository, and ask us about the OSS
					program.
				</p>
				<div className="mt-9">
					<DiscordLink source="oss-program-cta" size="lg">
						Apply in Discord
						<HugeiconsIcon icon={ArrowUpRight03Icon} />
					</DiscordLink>
				</div>
				<p className="mt-4 text-xs text-[#68647a]">
					Share your repository and tell us how your community uses Discord.
				</p>
			</div>
		</section>
	);
}

function DiscordLink({
	children,
	size,
	source,
}: {
	children: React.ReactNode;
	size: "sm" | "lg";
	source: string;
}) {
	return (
		<TrackLink
			className={cn(
				buttonVariants({ size }),
				"rounded-full bg-[#20201e] font-semibold shadow-none transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-[#393936] active:translate-y-0 active:scale-[0.96]",
				size === "lg" && "h-12 w-full px-6 text-base sm:w-auto",
			)}
			eventData={{ source }}
			eventKey="ossProgramContact"
			href="https://discord.gg/B23gNekHPy"
			rel="noopener"
			target="_blank"
		>
			{children}
		</TrackLink>
	);
}

function Footer() {
	return (
		<footer className="border-[#cbc9bf] border-t bg-[#20201e] text-white/65">
			<div className="mx-auto flex max-w-[1280px] flex-col gap-6 border-white/10 border-x px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
				<div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
					<span className="text-lg text-white">Velumn</span>
					<span>Help more people find your Discord community.</span>
				</div>
				<div className="flex flex-wrap gap-x-6 gap-y-3">
					<Link
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e]"
						href="/"
					>
						Product
					</Link>
					<a
						className="rounded-sm transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#20201e]"
						href="https://discord.gg/B23gNekHPy"
						rel="noopener noreferrer"
						target="_blank"
					>
						Discord ↗
					</a>
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
