"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ChannelSelector } from "@/components/channel-selector";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";
import type { SortChannel } from "@/providers/onboarding";

export function OnboardingChannelSelector({
	channels,
	serverId,
}: {
	channels: SortChannel[];
	serverId?: string;
}) {
	const [selectedChannelIds, setSelectedChannelIds] = useState(
		new Set(channels.filter((c) => c.enabled).map((c) => c.id)),
	);

	const router = useRouter();
	const trpc = useTRPC();
	const finishOnBoardingMutation = useMutation(
		trpc.server.finishOnboarding.mutationOptions({
			onError(error) {
				toast.error(error.message);
			},
			onSuccess() {
				toast.success("Indexing started!");
				router.push(`/server/${serverId}`);
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
						selectedChannelIds.size === 0 || finishOnBoardingMutation.isPending
					}
					onClick={() => {
						const payload = channels.map((c) => ({
							channelId: c.id,
							status: selectedChannelIds.has(c.id),
						}));

						finishOnBoardingMutation.mutate({
							serverId: serverId!,
							payload,
						});
					}}
					variant="default"
					className="rounded-none"
				>
					Finish onboarding
				</Button>
			</div>
		</>
	);
}
