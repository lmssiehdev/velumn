"use client";

import {
	ArrowsSplitIcon,
	DiscordLogoIcon,
	LightningIcon,
	RocketIcon,
	ShieldIcon,
	SparkleIcon,
	UsersFourIcon,
	WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { JSX } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface Feature {
	name: string;
	velumn: string;
	traditional: string;
	Icon: JSX.Element;
}
const features: Feature[] = [
	{
		name: "Where you work",
		Icon: (
			<DiscordLogoIcon
				className="inline-block mr-2 size-4 text-indigo-600"
				weight="duotone"
			/>
		),
		velumn: "Native Discord integration",
		traditional: "External platform redirect",
	},
	{
		name: "Setup time",
		Icon: (
			<LightningIcon
				className="inline-block mr-2 size-4 text-yellow-500"
				weight="duotone"
			/>
		),
		velumn: "Live in 2 minutes",
		traditional: "Take days to setup",
	},
	// {
	// 	name: "Content sync",
	// 	Icon: (
	// 		<ArrowsClockwiseIcon
	// 			className="inline-block mr-2 size-4 text-blue-500"
	// 			weight="duotone"
	// 		/>
	// 	),
	// 	velumn: "Real-time, bi-directional",
	// 	traditional: "Manual copy-paste chaos",
	// },
	{
		name: "Design",
		Icon: (
			<SparkleIcon
				className="inline-block mr-2 size-4 text-purple-500"
				weight="duotone"
			/>
		),
		velumn: "Modern, beautiful UI",
		traditional: "Outdated forum aesthetic",
	},
	{
		name: "Community split",
		Icon: (
			<ArrowsSplitIcon
				className="inline-block mr-2 size-4 text-red-500"
				weight="duotone"
			/>
		),
		velumn: "Never, one home",
		traditional: "Always, two platforms",
	},
	{
		name: "Moderation",
		Icon: (
			<ShieldIcon
				className="inline-block mr-2 size-4 text-green-600"
				weight="duotone"
			/>
		),
		velumn: "Same mods, same tools",
		traditional: "New admin panel to learn",
	},
	{
		name: "Member experience",
		Icon: (
			<UsersFourIcon
				className="inline-block mr-2 size-4 text-cyan-500"
				weight="duotone"
			/>
		),
		velumn: "Stay in Discord",
		traditional: '"Also join our forum!"',
	},
	{
		name: "Maintenance",
		Icon: (
			<WrenchIcon
				className="inline-block mr-2 size-4 text-orange-500"
				weight="duotone"
			/>
		),
		velumn: "Zero, we handle it",
		traditional: "Constant updates",
	},
	{
		name: "Built for",
		Icon: (
			<RocketIcon
				className="inline-block mr-2 size-4 text-pink-500"
				weight="duotone"
			/>
		),
		velumn: "New age startups",
		traditional: "Legacy enterprises",
	},
];
export function ComparisonTable() {
	return (
		<>
			<div className="mb-20">
				<h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
					All the benefits of Discord, without any of the downsides.
				</h2>
				<p className="mx-auto text-lg text-neutral-600">
					Stop forcing your members to leave Discord. Get all the benefits of a
					forum without splitting your community across platforms.
				</p>
			</div>

			<div>
				<Table className="text-base">
					<TableHeader>
						<TableRow>
							<TableHead className="w-1/3 text-left">Feature</TableHead>
							<TableHead className="w-1/3">Velumn</TableHead>
							<TableHead className="w-1/3 text-neutral-500">
								Traditional Forums
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody className="divide-y divide-gray-100">
						{features.map((feature, index) => {
							return (
								<TableRow key={index}>
									<TableCell>{feature.name}</TableCell>
									<TableCell>
										{feature.Icon}
										<span>{feature.velumn}</span>
									</TableCell>
									<TableCell className="text-neutral-500">
										{feature.traditional}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</>
	);
}

{
	/* <section className="my-40 border-neutral-300 border-t px-4 md:my-32">
					<div className="mx-auto max-w-7xl">
						<div className="space-y-3 py-24 text-center md:py-30">
							<span className="text-lg text-neutral-600">Why choose?</span>
							<h2 className="mx-auto max-w-3xl font-semibold text-3xl md:text-4xl">
								All the benefits of Discord, without any of the downsides
							</h2>
						</div>

						<div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
							<div className="rounded border bg-neutral-50 p-6 md:p-8">
								<div className="mb-6 flex items-center gap-3">
									<Twemoji className="size-8 shrink-0" name="😫" />
									<h3 className="font-bold text-2xl tracking-tight md:text-3xl">
										Traditional Forums
									</h3>
								</div>
								<ul className="flex flex-col gap-6 text-lg text-neutral-700 md:text-xl">
									<li className="flex items-start gap-3">
										<DotOutlineIcon
											className="mt-1 size-6 shrink-0 text-neutral-400"
											weight="fill"
										/>
										<span>Build a separate community (double the work!)</span>
									</li>
									<li className="flex items-start gap-3">
										<DotOutlineIcon
											className="mt-1 size-6 shrink-0 text-neutral-400"
											weight="fill"
										/>
										<span>Manage logins, moderation, spam... twice</span>
									</li>
									<li className="flex items-start gap-3">
										<DotOutlineIcon
											className="mt-1 size-6 shrink-0 text-neutral-400"
											weight="fill"
										/>
										<span>Watch your community split in half</span>
									</li>
									<li className="flex items-start gap-3">
										<DotOutlineIcon
											className="mt-1 size-6 shrink-0 text-neutral-400"
											weight="fill"
										/>
										<span>Place bets on which dies first</span>
									</li>
								</ul>
							</div>
							<div className="rounded border-4 border-purple-600 bg-purple-50 p-6 shadow-lg md:p-8">
								<div className="mb-6 flex items-center gap-3">
									<Twemoji className="size-8 shrink-0" name="✨" />
									<h3 className="font-bold text-2xl tracking-tight md:text-3xl">
										With Velumn
									</h3>
								</div>
								<ul className="flex flex-col gap-6 text-lg md:text-xl">
									<li className="flex items-start gap-3">
										<CheckFatIcon className="mt-1 size-6 shrink-0 text-purple-600" />
										<span>Discord ⇒ forum automagically</span>
									</li>
									<li className="flex items-start gap-3">
										<CheckFatIcon className="mt-1 size-6 shrink-0 text-purple-600" />
										<span>Zero extra work (seriously, none)</span>
									</li>
									<li className="flex items-start gap-3">
										<CheckFatIcon className="mt-1 size-6 shrink-0 text-purple-600" />
										<span>One community, everywhere it needs to be</span>
									</li>
									<li className="flex items-start gap-3">
										<CheckFatIcon className="mt-1 size-6 shrink-0 text-purple-600" />
										<span>Live in minutes, not weeks</span>
									</li>
								</ul>
							</div>
						</div>
					</div>
				</section> */
}
