import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { Providers } from "@/app/providers";
import { getGuildsCache } from "@/cache";
import { Button } from "@/components/ui/button";

import { createServerApi } from "@/server/trpc/root";
import { getCurrentUserOrRedirect } from "@/server/user";
import { getOnboardingStatus } from "@/utils/get-onboarding-status";
import { GuildListItem, StageHeader } from "../../_components";
import { OnboardingChannelSelector } from "../_component";

export default async function Page({
	params,
}: {
	params: Promise<{
		id: string;
	}>;
}) {
	const { user } = await getCurrentUserOrRedirect();
	const { id: serverId } = await params;

	// Use centralized onboarding status check
	const onboardingStatus = await getOnboardingStatus({
		userId: user.id,
		serverId,
	});

	switch (onboardingStatus.status) {
		case "onboarding":
			return redirect(`/onboarding/`);
		case "inviting-bot":
			return redirect(`/onboarding/invite-bot/${serverId}`);
		case "finished":
			return redirect(`/server/${serverId}`);
		case "selecting-channels":
			// User is on the correct page
			break;
	}

	const guilds = await getGuildsCache(user.id);

	if (typeof guilds === "object" && "error" in guilds) {
		return <div>Error: {guilds.error}</div>;
	}

	const guild = guilds.find((g) => g.id === serverId);

	if (!guild) {
		redirect(`/onboarding/`);
	}
	const trpc = await createServerApi();
	const serverChannels = await trpc.server.getChannelsInServer({
		serverId,
	});

	if (!serverChannels.channels.length) {
		return <div>No channels found</div>;
	}

	const fetchedChannels = serverChannels.channels.map((c) => ({
		...c,
		enabled: true,
	}));

	return (
		<Providers>
			<StageHeader
				title="Select channels to index!"
				emoji="✨"
				subtitle="We'll do the rest for you"
			/>
			<div className="mx-auto w-full max-w-md space-y-2">
				<GuildListItem guild={guild}>
					<Button variant="default" className=" rounded-none" disabled>
						<CheckIcon className="size-4" />
						Already Added
					</Button>
				</GuildListItem>
				<OnboardingChannelSelector
					serverId={serverId}
					channels={fetchedChannels}
				/>
			</div>
		</Providers>
	);
}
