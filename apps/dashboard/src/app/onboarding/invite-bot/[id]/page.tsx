import { redirect } from "next/navigation";
import { Providers } from "@/app/providers";
import { getGuildsCache } from "@/cache";
import { buttonVariants } from "@/components/ui/button";
import { createServerApi } from "@/server/trpc/root";
import { getCurrentUserOrRedirect } from "@/server/user";
import { getOnboardingStatus } from "@/utils/get-onboarding-status";
import { GuildListItem, StageHeader } from "../../_components";
import { InviteBotStatusMessage } from "../_components";

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
		options: {
			skipDBCheck: true,
		},
	});

	console.log({ onboardingStatus });
	switch (onboardingStatus.status) {
		case "onboarding":
			return redirect(`/onboarding/`);
		case "selecting-channels":
			return redirect(`/onboarding/select-channels/${serverId}`);
		case "finished":
			return redirect(`/server/${serverId}`);
		case "inviting-bot":
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
	const { inviteUrl } = await trpc.server.createServerInvite({
		serverId,
	});

	return (
		<Providers>
			<StageHeader
				title="Almost there!"
				emoji="🎯"
				subtitle="Add the bot to your server to continue"
			/>
			<div className="mx-auto w-full max-w-md space-y-8">
				<GuildListItem guild={guild}>
					<a
						className={buttonVariants({ variant: "outline" })}
						href={inviteUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						Invite Bot
					</a>
				</GuildListItem>
				<InviteBotStatusMessage serverId={serverId} />
			</div>
		</Providers>
	);
}
