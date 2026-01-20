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
