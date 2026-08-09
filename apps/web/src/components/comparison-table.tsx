"use client";

import DiscordIcon from "@hugeicons/core-free-icons/DiscordIcon";
import FlashIcon from "@hugeicons/core-free-icons/FlashIcon";
import Rocket01Icon from "@hugeicons/core-free-icons/Rocket01Icon";
import Shield01Icon from "@hugeicons/core-free-icons/Shield01Icon";
import SparklesIcon from "@hugeicons/core-free-icons/SparklesIcon";
import SplitIcon from "@hugeicons/core-free-icons/SplitIcon";
import UserGroupIcon from "@hugeicons/core-free-icons/UserGroupIcon";
import Wrench01Icon from "@hugeicons/core-free-icons/Wrench01Icon";
import { HugeiconsIcon } from "@hugeicons/react";
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
			<HugeiconsIcon
				className="inline-block mr-2 size-4 text-indigo-600"
				icon={DiscordIcon}
			/>
		),
		velumn: "Native Discord integration",
		traditional: "External platform redirect",
	},
	{
		name: "Setup time",
		Icon: (
			<HugeiconsIcon
				className="inline-block mr-2 size-4 text-yellow-500"
				icon={FlashIcon}
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
			<HugeiconsIcon
				className="inline-block mr-2 size-4 text-purple-500"
				icon={SparklesIcon}
			/>
		),
		velumn: "Modern, beautiful UI",
		traditional: "Outdated forum aesthetic",
	},
	{
		name: "Community split",
		Icon: (
			<HugeiconsIcon
				className="inline-block mr-2 size-4 text-red-500"
				icon={SplitIcon}
			/>
		),
		velumn: "Never, one home",
		traditional: "Always, two platforms",
	},
	{
		name: "Moderation",
		Icon: (
			<HugeiconsIcon
				className="inline-block mr-2 size-4 text-green-600"
				icon={Shield01Icon}
			/>
		),
		velumn: "Same mods, same tools",
		traditional: "New admin panel to learn",
	},
	{
		name: "Member experience",
		Icon: (
			<HugeiconsIcon
				className="inline-block mr-2 size-4 text-cyan-500"
				icon={UserGroupIcon}
			/>
		),
		velumn: "Stay in Discord",
		traditional: '"Also join our forum!"',
	},
	{
		name: "Maintenance",
		Icon: (
			<HugeiconsIcon
				className="inline-block mr-2 size-4 text-orange-500"
				icon={Wrench01Icon}
			/>
		),
		velumn: "Zero, we handle it",
		traditional: "Constant updates",
	},
	{
		name: "Built for",
		Icon: (
			<HugeiconsIcon
				className="inline-block mr-2 size-4 text-pink-500"
				icon={Rocket01Icon}
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
