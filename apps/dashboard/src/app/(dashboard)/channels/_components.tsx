"use client";

import type { DBChannel } from "@repo/db/schema/discord";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChannelsSelector } from "@/app/onboarding/page";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";

type SortChannel = DBChannel & { enabled: boolean };

export default function Channels({
	initialChannels,
}: {
	initialChannels: SortChannel[];
}) {
	const [channels, setChannels] = useState<SortChannel[]>(initialChannels);
	function toggleChannel(channelId: string, enabled: boolean) {
		setChannels((prev) =>
			prev.map((c) => (c.id === channelId ? { ...c, enabled } : c)),
		);
	}
	const trpc = useTRPC();
	const updateChannelsMutation = useMutation(
		trpc.server.updateChannelsIndexingStatus.mutationOptions(),
	);

	const selectedChannels = channels.filter((c) => c.enabled).map((c) => c.id);

	async function onSubmit() {
		const toastId = toast.loading("Updating channel preferences...");

		updateChannelsMutation.mutate(
			{
				payload: channels.map((c) => ({ channelId: c.id, status: c.enabled })),
			},
			{
				onSuccess: () => {
					toast.success("Channel preferences updated successfully", {
						id: toastId,
					});
				},
				onError: (error) => {
					toast.error("Failed to update preferences. Please try again.", {
						id: toastId,
					});
					console.error("Update error:", error);
				},
			},
		);
	}

	return (
		<div className="mx-auto w-full max-w-md">
			<div className="my-4">
				<div className="text-2xl">Channel Indexing</div>
				<p className="text-neutral-600">Select which channels to index.</p>
			</div>
			<div className="space-y-4">
				<ChannelsSelector channels={channels} toggleChannel={toggleChannel} />
				<div className="flex justify-between">
					<div>
						<div>{selectedChannels.length} channels selected</div>
					</div>

					<Button
						className="flex items-center gap-2"
						disabled={updateChannelsMutation.isPending}
						onClick={() => onSubmit()}
					>
						Update
					</Button>
				</div>
			</div>
		</div>
	);
}
