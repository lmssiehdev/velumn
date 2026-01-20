import { checkIfServerExistsForUser } from "@repo/db/helpers/servers";
import type { DBServer } from "@repo/db/schema/discord";
import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/utils/get-onboarding-status";
import { log } from "./log";

type AuthorizationResult =
	| {
			authorized: false;
			error?: string;
	  }
	| {
			authorized: true;
			server: DBServer & {
				finishedOnboarding?: boolean;
			};
	  };

export async function verifyServerOwnership(
	userId: string,
	serverId: string,
): Promise<AuthorizationResult> {
	try {
		const userServer = await checkIfServerExistsForUser({
			userId,
			serverId,
		});

		if (!userServer || !userServer.server) {
			return {
				authorized: false,
				error: "You don't have access to this server",
			};
		}
		return {
			authorized: true,
			server: {
				...userServer.server,
				finishedOnboarding: userServer.finishedOnboarding,
			},
		};
	} catch (error) {
		log.error("server_ownership_verification_failed", {
			userId,
			serverId,
			error: error instanceof Error ? error.message : "unknown_error",
		});

		return {
			authorized: false,
			error: "Failed to verify server ownership",
		};
	}
}

/**
 * Verifies server ownership and returns server data for page components
 */
export async function requireServerForPage(userId: string, serverId: string) {
	const onboardingStatus = await getOnboardingStatus({ userId, serverId });

	switch (onboardingStatus.status) {
		case "onboarding":
			return redirect("/onboarding/");
		case "inviting-bot":
			return redirect(`/onboarding/invite-bot/${serverId}`);
		case "selecting-channels":
			return redirect(`/onboarding/select-channels/${serverId}`);
		case "finished":
			return onboardingStatus.server;
	}
}
