import {
	ArrowUpRightIcon,
	CaretDownIcon,
	ChatsTeardropIcon,
	DotsThreeVerticalIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TrackLink } from "@/components/analytics/track-link";
import { ComparisonTable } from "@/components/comparison-table";
import { Twemoji } from "@/components/markdown/emoji";
import {
	FaqJsonLd,
	OrganizationJsonLd,
	WebsiteJsonLd,
} from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { absoluteUrl, buildPageMetadata } from "@/lib/seo";
import { AnimatedBeamSection } from "./(marketing)/_components/beam";

export const dynamic = "force-static";

export const metadata: Metadata = buildPageMetadata({
	title: "Discord SEO Platform for Searchable Communities",
	description:
		"Velumn turns Discord channels into indexed, searchable forums that rank on Google, appear in AI answers, and grow your community organically.",
	canonicalUrl: absoluteUrl("/"),
});

const homepageFaqItems = [
	{
		question: "How does Velumn work?",
		answer:
			"Velumn crawls your Discord server and indexes the channels you choose, turning them into SEO-friendly forum pages while your community keeps using Discord.",
	},
	{
		question: "What sets Velumn apart from other forum solutions?",
		answer:
			"Velumn keeps your community in Discord instead of splitting conversations across a separate forum platform, while still making discussions searchable on the web.",
	},
	{
		question: "How does Velumn handle privacy?",
		answer:
			"Velumn only indexes channels you select, syncs display names instead of Discord tags or avatars, and supports anonymized display names when privacy matters.",
	},
	{
		question: "Is there a limit on members?",
		answer: "No. Velumn can index servers of all sizes.",
	},
] as const;

export default function Home() {
	return (
		<>
			<OrganizationJsonLd />
			<WebsiteJsonLd />
			<FaqJsonLd items={[...homepageFaqItems]} />
			<div className="border-neutral-300 border-x border-b">
				<div className="mx-auto flex max-w-6xl items-center justify-between border-neutral-300 border-x p-2 px-4">
					<div className="flex items-center gap-6">
						<Link className="text-black text-xl" href="/">
							Velumn <span className="text-xs text-neutral-600">[beta]</span>
						</Link>
					</div>
					<a
						className={buttonVariants({ size: "sm", variant: "outline" })}
						href="https://github.com/lmssiehdev/velumn"
						rel="noopener"
						target="_blank"
					>
						<Twemoji className="size-4.5" name="⭐" />
						<span>Star us on GitHub</span>
					</a>
				</div>
			</div>
			<div className="mx-auto max-w-6xl border-neutral-300 border-x">
				<header className="px-4 py-40">
					<div className="mx-auto max-w-4xl space-y-4">
						<h1 className="font-bold text-4xl leading-tight sm:text-5xl md:text-6xl lg:text-7xl">
							The community platform <br className="hidden sm:block" />
							built for Discord
						</h1>
						<p className="max-w-[630px] text-neutral-600 text-sm sm:text-base font-medium leading-relaxed">
							Transform your Discord channels into a fully indexed,
							SEO-optimized forum in minutes.
							<br />
							Get discovered on Google, grow your community all without leaving
							Discord.
						</p>
						<div className="mt-8 flex flex-col gap-4 sm:flex-row">
							<TrackLink
								eventKey="addServer"
								eventData={{
									source: "homepage-header",
								}}
								className={buttonVariants({ size: "lg" })}
								href="https://dashboard.velumn.com"
								rel="noopener"
								target="_blank"
							>
								Get Started
							</TrackLink>
							<TrackLink
								eventKey="clickedDemoLink"
								eventData={undefined}
								className={buttonVariants({ size: "lg", variant: "outline" })}
								href="/thread/1436230598959300718/a_demo_thread"
							>
								<ArrowUpRightIcon className="inline-block h-4 w-4" />
								Check the demo
							</TrackLink>
						</div>
					</div>
				</header>

				<section className="border-neutral-300 border-t px-4 py-40">
					<div className="mx-auto max-w-4xl mb-20">
						<h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
							Your Discord. Your content. Everywhere.
						</h2>
						<p className="text-lg text-neutral-600">
							No extra platforms, no extra work just Discord conversations that
							reach everyone searching.
						</p>
					</div>
					<div className="max-w-4xl mx-auto">
						<AnimatedBeamSection />
					</div>
				</section>

				<section className="border-neutral-300 border-t px-4 py-40">
					<div className="mx-auto max-w-4xl">
						<ComparisonTable />
					</div>
				</section>

				<section className="border-neutral-300 border-t px-4 py-40">
					<div className="mx-auto max-w-4xl">
						<FAQ />
					</div>
				</section>

				<section className="border-neutral-300 border-t px-4 py-40">
					<div className="mx-auto max-w-4xl">
						<BottomCTA />
					</div>
				</section>
			</div>
			<footer className="border-neutral-300 border-x border-t">
				<div className="mx-auto max-w-6xl border-x px-4 py-6">
					<div className="flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
						<p className="text-neutral-600 text-sm">
							Built with <Twemoji className="inline size-4.5" name="💜" /> and
							way too many Discord servers .{" "}
							<a
								className="text-neutral-900 underline transition-colors hover:text-neutral-600"
								href="https://github.com/lmssiehdev/velumn"
								rel="noopener noreferrer"
								target="_blank"
							>
								Open source on GitHub ↗
							</a>
						</p>
					</div>
				</div>
			</footer>
		</>
	);
}

export function FAQ() {
	return (
		<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
			<div className="space-y-2 md:col-span-1">
				<h2 className="font-bold text-4xl">Got questions?</h2>
				<p className="text-neutral-500 text-4xl">We've got answers.</p>
			</div>
			<div className="prose mx-auto w-full max-w-full space-y-4 md:col-span-2 [*_p]:max-w-full">
				<Collapsible>
					<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
						How does Velumn work?
						<CaretDownIcon className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
					</CollapsibleTrigger>
					<CollapsibleContent className="px-4 pt-2 pb-4">
						<div>
							Velumn crawls your Discord server and indexes threads in channels
							you specify, turning them into beautifully designed,
							well-optimized, SEO-friendly pages.
						</div>

						<div>
							You keep doing what you do best building community on Discord
							while Velumn makes those conversations discoverable on the web.
						</div>
					</CollapsibleContent>
				</Collapsible>

				<Collapsible>
					<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
						What sets Velumn apart from other forum solutions?
						<CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
					</CollapsibleTrigger>
					<CollapsibleContent className="px-4 pt-2 pb-4">
						<p>
							Velumn is the right choice if you already have or are planning to
							build a community on Discord. With Velumn, you get all the
							advantages of a traditional forum without splitting your focus
							between two different platforms or dealing with the hassle of
							managing your own infrastructure.
						</p>
					</CollapsibleContent>
				</Collapsible>

				<Collapsible>
					<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
						How does Velumn handle privacy?
						<CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
					</CollapsibleTrigger>
					<CollapsibleContent className="px-4 pt-2 pb-4">
						<div className="max-w-full">
							Velumn goes to great lengths to ensure your community stays
							private when needed. We do not sync avatars or Discord tags we
							only sync display names. Users also have the option to anonymize
							their display names using the{" "}
							<pre className="inline rounded bg-neutral-200 p-0.5! text-black">
								/anonymize
							</pre>{" "}
							command.
						</div>

						<p>
							We're actively working on making this even better. If you have any
							suggestions, please let us know.
						</p>
					</CollapsibleContent>
				</Collapsible>

				<Collapsible>
					<CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left font-medium hover:bg-accent">
						Is there a limit on members?
						<CaretDownIcon className="h-4 w-4 transition-transform duration-200" />
					</CollapsibleTrigger>
					<CollapsibleContent className="px-4 pt-2 pb-4">
						<p>No. We index servers of all sizes.</p>
					</CollapsibleContent>
				</Collapsible>
			</div>
		</div>
	);
}

function BottomCTA() {
	return (
		<div className="space-y-6 rounded border bg-white px-8 py-40 text-center">
			<h2 className="font-bold text-4xl leading-tight">
				Ready to make your Discord searchable?
			</h2>
			<p className="text-neutral-600">
				Try Velumn for free. No credit card required.
			</p>
			<TrackLink
				eventKey="addServer"
				eventData={{
					source: "homepage-CTA",
				}}
				className={buttonVariants({ size: "lg" })}
				href="https://dashboard.velumn.com"
				rel="noopener"
				target="_blank"
			>
				Get Started
			</TrackLink>
		</div>
	);
}

export function Preview() {
	return (
		<div className="relative mx-auto my-8 flex max-w-3xl items-center rounded shadow-xl">
			<div className="-top-[40%] -left-[35%] absolute">
				<div className="w-full max-w-sm overflow-hidden rounded border bg-[#fefcf6] text-black shadow">
					<div className="flex items-center gap-2 border-neutral-200 border-b px-4 pt-4 pb-2">
						<DiscordIcon />
						<span>How do I index discord channels into google?</span>
					</div>
					<div className="space-y-4 p-4">
						<div className="flex gap-3">
							<div className="size-10 rounded-full bg-[#ced1e4]" />
							<div className="flex-1">
								<div className="font-bold text-sm tracking-wider">
									lmssiehdev
								</div>
								<p>How do I index my discord channels into google?</p>
							</div>
						</div>
						<div className="flex gap-3">
							<div className="size-10 rounded-full bg-[#ced1e4]" />
							<div className="flex-1">
								<div className="mb-2 h-3 w-10 rounded bg-[#ced1e4]" />
								<div className="h-5 rounded bg-[#ced1e4]" />
							</div>
						</div>
					</div>
				</div>
				<div className="-scale-x-[1] -rotate-120 ml-52 size-20">
					<Image
						alt=""
						height={97}
						loading="lazy"
						src="/assets/arrow.png"
						width={202}
					/>
				</div>
			</div>
			<div className="">
				<Image
					alt="Velumn forum preview"
					className="object-cover"
					height={1444}
					loading="lazy"
					src="/assets/landing/ss-demo-preview.png"
					width={2450}
				/>
			</div>
			<div className="-bottom-[20%] -right-[35%] absolute">
				<div className="ml-33 size-20 rotate-40">
					<Image
						alt=""
						height={97}
						loading="lazy"
						src="/assets/arrow.png"
						width={202}
					/>
				</div>
				<div className="w-[430px] space-y-1.5 overflow-hidden rounded border bg-[#fefcf6] p-4 text-black shadow">
					<div className="mb-2 flex items-center gap-4 p-2">
						<div className="font-bold text-xl">Google</div>
						<div className="w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-[#e7e8f0] px-4 py-1.5">
							How do I index discord channels into google?
						</div>
					</div>
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-full bg-white">
							<ChatsTeardropIcon className="size-6 text-black" />
						</div>
						<div className="text-sm">
							<div>Velumn</div>
							<div className="align-baseline text-sm">
								https://velumn.com &gt; thread ...{" "}
								<DotsThreeVerticalIcon className="inline-block" weight="bold" />
							</div>
						</div>
					</div>
					<div>
						<div className="mb-1 text-lg">
							How do I index my discord channels into google?
						</div>
						<div className="flex items-center gap-2">
							<div className="text-sm">Jun 18, 2023 — </div>
							<div className="h-3 flex-1 rounded bg-[#ced1e4]" />
						</div>
						<div className="mb-1 h-3 flex-1 rounded bg-[#ced1e4]" />
						<div className="mb-1 h-3 flex-1 rounded bg-[#ced1e4]" />
					</div>
				</div>
			</div>
		</div>
	);
}
function DiscordIcon() {
	return (
		<svg
			className="inline-block size-5"
			viewBox="0 0 126.644 96"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M81.15 0a74 74 0 0 0-3.36 6.794 97.9 97.9 0 0 0-28.994 0A68 68 0 0 0 45.437 0a105.6 105.6 0 0 0-26.14 8.057C2.779 32.53-1.691 56.373.53 79.887a105 105 0 0 0 32.05 16.088 77 77 0 0 0 6.87-11.063c-3.738-1.389-7.35-3.131-10.81-5.152.91-.657 1.794-1.338 2.653-1.995a75.26 75.26 0 0 0 64.075 0c.86.707 1.743 1.389 2.652 1.995a69 69 0 0 1-10.835 5.178A77 77 0 0 0 94.056 96a105 105 0 0 0 32.051-16.063c2.626-27.277-4.496-50.917-18.817-71.855A104 104 0 0 0 81.175.05zM42.28 65.414c-6.238 0-11.416-5.657-11.416-12.653s4.976-12.679 11.391-12.679 11.517 5.708 11.416 12.679c-.101 6.97-5.026 12.653-11.39 12.653m42.078 0c-6.264 0-11.391-5.657-11.391-12.653s4.975-12.679 11.39-12.679S95.85 45.79 95.749 52.761c-.1 6.97-5.026 12.653-11.39 12.653"
				fill="currentColors"
			/>
		</svg>
	);
}
