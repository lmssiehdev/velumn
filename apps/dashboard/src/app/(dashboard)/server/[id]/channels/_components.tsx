"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChannelSelector } from "@/components/channel-selector";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";
import type { SortChannel } from "@/providers/onboarding";
import { useServer } from "@/providers/server";

export function OnboardingChannelSelector({
	channels,
}: {
	channels: SortChannel[];
}) {
	const { server } = useServer();
	const [selectedChannelIds, setSelectedChannelIds] = useState(
		new Set(channels.filter((c) => c.enabled).map((c) => c.id)),
	);

	const trpc = useTRPC();
	const updateChannelsIndexingStatus = useMutation(
		trpc.server.updateChannelsIndexingStatus.mutationOptions({
			onError(error) {
				toast.error(error.message);
			},
			onSuccess() {
				toast.success("updated channels");
			},
		}),
	);

	return (
		<>
			<ChannelSelector
				channels={channels}
				selectedChannelIds={selectedChannelIds}
				onSelectionChange={setSelectedChannelIds}
			/>
			<div className="flex justify-end mt-4">
				<Button
					disabled={
						selectedChannelIds.size === 0 ||
						updateChannelsIndexingStatus.isPending
					}
					onClick={() => {
						updateChannelsIndexingStatus.mutate({
							serverId: server!.id,
							payload: channels.map((c) => ({
								channelId: c.id,
								status: selectedChannelIds.has(c.id),
							})),
						});
					}}
					variant="default"
					className="rounded-none"
				>
					Update channels
				</Button>
			</div>
		</>
	);
}
