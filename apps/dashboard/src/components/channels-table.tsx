"use client";

import type { DBChannel } from "@repo/db/schema/discord";
import { OnboardingChannelSelector } from "@/app/(dashboard)/server/[id]/channels/_components";

type SortChannel = DBChannel & { enabled: boolean };

interface ChannelsTableProps {
	channels: SortChannel[];
	serverId: string;
}

export default function ChannelsTable({
	channels: initialChannels,
}: ChannelsTableProps) {
	return (
		<div className="mx-auto w-full max-w-md">
			<div className="my-4">
				<div className="text-2xl">Channel Indexing</div>
				<p className="text-neutral-600">Select which channels to index.</p>
			</div>
			<OnboardingChannelSelector channels={initialChannels} />
		</div>
	);
}
