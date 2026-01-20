"use client";

import {
	ChatsCircleIcon,
	HashIcon,
	MagnifyingGlassIcon,
} from "@phosphor-icons/react/dist/ssr";
import { ChannelType } from "discord-api-types/v10";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import type { SortChannel } from "@/providers/onboarding";

export function ChannelSelector({
	channels,
	selectedChannelIds,
	onSelectionChange,
}: {
	channels: SortChannel[];
	selectedChannelIds: Set<string>;
	onSelectionChange: (selected: Set<string>) => void;
}) {
	const [searchFilter, setSearchFilter] = useState("");

	const toggleChannel = (channelId: string, enabled: boolean) => {
		const next = new Set(selectedChannelIds);
		if (enabled) {
			next.add(channelId);
		} else {
			next.delete(channelId);
		}
		onSelectionChange(next);
	};

	const { selectedChannels, otherChannels } = useMemo(() => {
		const filtered = channels.filter((c) => {
			if (!searchFilter) return true;
			return c.channelName?.toLowerCase().includes(searchFilter.toLowerCase());
		});

		const selected = filtered
			.filter((c) => selectedChannelIds.has(c.id))
			.sort((a, b) => b.type - a.type);

		const other = filtered
			.filter((c) => !selectedChannelIds.has(c.id))
			.sort((a, b) => b.type - a.type);

		return { selectedChannels: selected, otherChannels: other };
	}, [searchFilter, channels, selectedChannelIds]);

	const ChannelItem = ({ channel }: { channel: SortChannel }) => (
		<div
			className="flex items-center gap-4 border-t border-r border-l p-2 last:border-b"
			key={channel.id}
		>
			<Checkbox
				checked={selectedChannelIds.has(channel.id)}
				onCheckedChange={(value) => toggleChannel(channel.id, value as boolean)}
			/>
			<div className="flex items-center gap-2">
				{channel.type === ChannelType.GuildForum ? (
					<ChatsCircleIcon className="size-4" />
				) : (
					<HashIcon className="size-4" weight="bold" />
				)}
				{channel.channelName}
			</div>
		</div>
	);

	return (
		<>
			<div>
				<InputGroup className="rounded-none">
					<InputGroupInput
						onChange={(e) => setSearchFilter(e.target.value)}
						placeholder="Filter channels..."
						autoComplete="off"
						value={searchFilter}
					/>
					<InputGroupAddon>
						<MagnifyingGlassIcon />
					</InputGroupAddon>
					<InputGroupAddon align="inline-end">{`${selectedChannelIds.size} of ${channels.length} selected`}</InputGroupAddon>
				</InputGroup>
				<div className="mt-2 flex justify-end">
					<Button
						size="sm"
						variant="outline"
						className="px-2 text-xs rounded-none ml-auto inline-block"
						onClick={() => {
							onSelectionChange(new Set(channels.map((c) => c.id)));
						}}
					>
						Select all channels
					</Button>
				</div>
			</div>
			{selectedChannels.length === 0 && otherChannels.length === 0 && (
				<div className="text-sm font-medium mt-2 mb-2 text-muted-foreground">
					No channels found, clear search filters
				</div>
			)}
			{selectedChannels.length > 0 && (
				<div>
					<h3 className="text-sm font-medium mt-2 mb-2 text-muted-foreground">
						Selected channels
					</h3>
					<div>
						{selectedChannels.map((channel) => (
							<ChannelItem key={channel.id} channel={channel} />
						))}
					</div>
				</div>
			)}

			{otherChannels.length > 0 && (
				<div>
					<h3 className="text-sm font-medium mt-2 mb-2 text-muted-foreground">
						Everything else
					</h3>
					<div>
						{otherChannels.map((channel) => (
							<ChannelItem key={channel.id} channel={channel} />
						))}
					</div>
				</div>
			)}
		</>
	);
}
